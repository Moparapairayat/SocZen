import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, sql, asc, desc, inArray, gte, isNull } from "drizzle-orm";
import {
  db,
  subscriptionRequests,
  services,
  formFields,
  grantedSubscriptions,
  requestStatusHistory,
  type SubscriptionRequest,
} from "@/db/client.server";
import { sendSubmissionEmails } from "@/utils/resend.server";
import {
  generateRequestReferenceCode,
  normalizeRequestReference,
} from "@/utils/request-tracking.server";
import { analyzeSubscriptionRequest } from "@/utils/ai.server";
import { checkSubmissionRateLimit, checkTrackingRateLimit } from "@/utils/ratelimit.server";

const REQUEST_STATUSES = ["pending", "approved", "rejected", "contacted"] as const;
export type PublicRequestStatus = (typeof REQUEST_STATUSES)[number];

export type PublicService = {
  id: string;
  slug: string;
  name: string;
  category: string;
  emoji: string;
  bg_class: string;
  description: string | null;
};

export type PublicFormField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "email" | "select" | "checkbox";
  placeholder: string | null;
  help_text: string | null;
  options: string[];
  is_required: boolean;
  is_builtin: boolean;
  max_length: number;
  sort_order: number;
};

export type PublicRequestHistoryEntry = {
  status: PublicRequestStatus;
  changed_at: string;
};

export type PublicTrackedRequest = {
  id: string;
  reference_code: string;
  status: PublicRequestStatus;
  created_at: string;
  selected_services: string[];
  history: PublicRequestHistoryEntry[];
};

const submitInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  selected_services: z.array(z.string().min(1).max(80)).min(1).max(10),
  company: z.string().trim().max(150).optional().nullable(),
  use_case: z.string().trim().max(2000).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
});

const trackInput = z.object({
  reference: z.string().trim().min(6).max(80),
  email: z.string().trim().email().max(255),
});

function normalizeSelectedServices(selectedServices: readonly string[]) {
  return Array.from(
    new Set(selectedServices.map((service) => service.trim().toLowerCase()).filter(Boolean)),
  );
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function assertNoInFlightRequests(email: string, selectedServicesList: readonly string[]) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedServices = normalizeSelectedServices(selectedServicesList);

  if (normalizedServices.length === 0) return;

  const existingRequests = await db
    .select({
      selectedServices: subscriptionRequests.selectedServices,
      status: subscriptionRequests.status,
    })
    .from(subscriptionRequests)
    .where(
      and(
        sql`lower(${subscriptionRequests.email}) = ${normalizedEmail}`,
        inArray(subscriptionRequests.status, ["pending", "contacted"]),
      ),
    );

  const matchedServices: string[] = [];
  for (const req of existingRequests) {
    for (const service of req.selectedServices) {
      if (normalizedServices.includes(service.trim().toLowerCase())) {
        matchedServices.push(service);
      }
    }
  }

  if (matchedServices.length > 0) {
    const uniqueMatches = Array.from(new Set(matchedServices));
    const label = uniqueMatches.length === 1 ? "subscription" : "subscriptions";
    throw new Error(
      `You already have an open request for ${label}: ${uniqueMatches.join(", ")}. Wait for that request to be reviewed before sending another one.`,
    );
  }
}

async function assertNoActiveGrants(email: string, selectedServicesList: readonly string[]) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedServices = normalizeSelectedServices(selectedServicesList);

  if (normalizedServices.length === 0) return;

  const now = new Date();
  const activeGrants = await db
    .select({
      serviceName: grantedSubscriptions.serviceName,
    })
    .from(grantedSubscriptions)
    .where(
      and(
        sql`lower(${grantedSubscriptions.email}) = ${normalizedEmail}`,
        eq(grantedSubscriptions.status, "active"),
        or(isNull(grantedSubscriptions.expiresAt), gte(grantedSubscriptions.expiresAt, now)),
      ),
    );

  const matchedServices: string[] = [];
  for (const grant of activeGrants) {
    if (normalizedServices.includes(grant.serviceName.trim().toLowerCase())) {
      matchedServices.push(grant.serviceName);
    }
  }

  if (matchedServices.length > 0) {
    const uniqueMatches = Array.from(new Set(matchedServices));
    const label = uniqueMatches.length === 1 ? "subscription" : "subscriptions";
    throw new Error(
      `You already have active access to ${label}: ${uniqueMatches.join(", ")}. Request again after that access expires.`,
    );
  }
}

export const getPublicCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ services: PublicService[]; fields: PublicFormField[] }> => {
    try {
      const [servicesList, fieldsList] = await Promise.all([
        db
          .select({
            id: services.id,
            slug: services.slug,
            name: services.name,
            category: services.category,
            emoji: services.emoji,
            bg_class: services.bgClass,
            description: services.description,
          })
          .from(services)
          .where(eq(services.isActive, true))
          .orderBy(asc(services.sortOrder)),
        db
          .select({
            id: formFields.id,
            field_key: formFields.fieldKey,
            label: formFields.label,
            field_type: formFields.fieldType,
            placeholder: formFields.placeholder,
            help_text: formFields.helpText,
            options: formFields.options,
            is_required: formFields.isRequired,
            is_builtin: formFields.isBuiltin,
            max_length: formFields.maxLength,
            sort_order: formFields.sortOrder,
          })
          .from(formFields)
          .where(eq(formFields.isActive, true))
          .orderBy(asc(formFields.sortOrder)),
      ]);

      return {
        services: servicesList,
        fields: fieldsList as PublicFormField[],
      };
    } catch (error) {
      console.error("getPublicCatalog error:", error);
      return { services: [], fields: [] };
    }
  },
);

export const submitSubscriptionRequest = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof submitInput>) => submitInput.parse(input))
  .handler(async ({ data }) => {
    // 1. Rate Limiting Check
    const rateLimit = await checkSubmissionRateLimit(data.email);
    if (!rateLimit.success) {
      throw new Error(rateLimit.message || "Rate limit exceeded. Please wait a minute.");
    }

    // 2. Prevent duplicate open requests / active grants
    await assertNoInFlightRequests(data.email, data.selected_services);
    await assertNoActiveGrants(data.email, data.selected_services);

    // 3. AI Triage & Fraud Detection
    const triage = await analyzeSubscriptionRequest({
      name: data.name,
      email: data.email,
      selectedServices: data.selected_services,
      company: data.company,
      useCase: data.use_case,
      message: data.message,
    });

    // 4. Generate reference code and insert record
    const referenceCode = generateRequestReferenceCode();

    const [inserted] = await db
      .insert(subscriptionRequests)
      .values({
        referenceCode,
        name: data.name,
        email: data.email,
        selectedServices: data.selected_services,
        company: data.company || null,
        useCase: data.use_case || null,
        message: data.message || null,
        customFields: data.custom_fields,
        aiScore: triage.score,
        aiRecommendation: triage.recommendation,
        aiAnalysis: triage,
        status: "pending",
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert subscription request");
    }

    // 5. Insert initial status history
    await db.insert(requestStatusHistory).values({
      requestId: inserted.id,
      status: "pending",
      note: "Request received into queue",
    });

    // 6. Send transactional emails
    try {
      await sendSubmissionEmails({
        name: data.name,
        email: data.email,
        selectedServices: data.selected_services,
        company: data.company || null,
        useCase: data.use_case || null,
        message: data.message || null,
        referenceCode: inserted.referenceCode,
      });
    } catch (emailError) {
      console.error("submitSubscriptionRequest email error:", emailError);
    }

    const createdAt = toIsoString(inserted.createdAt);

    return {
      ok: true as const,
      request: {
        id: inserted.id,
        reference_code: inserted.referenceCode,
        status: inserted.status as PublicRequestStatus,
        created_at: createdAt,
        selected_services: inserted.selectedServices,
        history: [{ status: inserted.status as PublicRequestStatus, changed_at: createdAt }],
      } satisfies PublicTrackedRequest,
    };
  });

export const trackSubscriptionRequest = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof trackInput>) => trackInput.parse(input))
  .handler(async ({ data }): Promise<{ request: PublicTrackedRequest }> => {
    const rateLimit = await checkTrackingRateLimit(data.email);
    if (!rateLimit.success) {
      throw new Error(rateLimit.message || "Too many lookups. Please wait a moment.");
    }

    const normalizedReference = normalizeRequestReference(data.reference);
    const rawReference = data.reference.trim();
    const normalizedEmail = data.email.trim().toLowerCase();

    const [row] = await db
      .select({
        id: subscriptionRequests.id,
        referenceCode: subscriptionRequests.referenceCode,
        status: subscriptionRequests.status,
        createdAt: subscriptionRequests.createdAt,
        selectedServices: subscriptionRequests.selectedServices,
      })
      .from(subscriptionRequests)
      .where(
        and(
          sql`lower(${subscriptionRequests.email}) = ${normalizedEmail}`,
          or(
            eq(subscriptionRequests.referenceCode, normalizedReference),
            sql`lower(${subscriptionRequests.id}::text) = lower(${rawReference})`,
          ),
        ),
      )
      .orderBy(desc(subscriptionRequests.createdAt))
      .limit(1);

    if (!row) {
      throw new Error("No request found for that email and reference");
    }

    const historyRows = await db
      .select({
        status: requestStatusHistory.status,
        changedAt: requestStatusHistory.changedAt,
      })
      .from(requestStatusHistory)
      .where(eq(requestStatusHistory.requestId, row.id))
      .orderBy(asc(requestStatusHistory.changedAt));

    const createdAt = toIsoString(row.createdAt);

    const history: PublicRequestHistoryEntry[] =
      historyRows.length > 0
        ? historyRows.map((h) => ({
            status: h.status as PublicRequestStatus,
            changed_at: toIsoString(h.changedAt),
          }))
        : [{ status: row.status as PublicRequestStatus, changed_at: createdAt }];

    return {
      request: {
        id: row.id,
        reference_code: row.referenceCode,
        status: row.status as PublicRequestStatus,
        created_at: createdAt,
        selected_services: row.selectedServices,
        history,
      },
    };
  });
