import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, sql, asc, desc, inArray, lt, isNotNull } from "drizzle-orm";
import {
  db,
  subscriptionRequests,
  services,
  formFields,
  grantedSubscriptions,
  requestStatusHistory,
  adminCredentials,
  type RequestStatusHistory,
} from "@/db/client.server";
import { sendRequestStatusEmail } from "@/utils/resend.server";
import { analyzeSubscriptionRequest } from "@/utils/ai.server";

const REQUEST_STATUSES = ["pending", "approved", "rejected", "contacted"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const FIELD_TYPES = ["text", "textarea", "email", "select", "checkbox"] as const;
export type FormFieldType = (typeof FIELD_TYPES)[number];

const GRANT_STATUSES = ["active", "expired", "revoked"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

export type StatusHistoryEntry = {
  id: string;
  status: RequestStatus;
  changed_at: string;
  note: string | null;
};

export type AdminRequest = {
  id: string;
  reference_code: string;
  name: string;
  email: string;
  company: string | null;
  selected_services: string[];
  use_case: string | null;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  custom_fields: Record<string, unknown>;
  history: StatusHistoryEntry[];
  ai_score?: number | null;
  ai_recommendation?: string | null;
  ai_analysis?: {
    score: number;
    recommendation: string;
    reason: string;
    summary: string;
    riskLevel: string;
    confidence: number;
  } | null;
};

export type AdminService = {
  id: string;
  slug: string;
  name: string;
  category: string;
  emoji: string;
  bg_class: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type AdminFormField = {
  id: string;
  field_key: string;
  label: string;
  field_type: FormFieldType;
  placeholder: string | null;
  help_text: string | null;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  is_builtin: boolean;
  max_length: number;
  sort_order: number;
};

export type AdminGrant = {
  id: string;
  email: string;
  name: string | null;
  service_name: string;
  request_id: string | null;
  granted_at: string;
  expires_at: string | null;
  status: GrantStatus;
  notes: string | null;
};

export type AdminRequester = {
  email: string;
  name: string;
  company: string | null;
  request_count: number;
  last_request_at: string;
  active_grants: number;
  expired_grants: number;
};

const AUTO_GRANT_NOTE = "Auto-created when the request was approved";
const ADMIN_PASSWORD_HASH_SCHEME = "pbkdf2_sha256";
const ADMIN_PASSWORD_HASH_ITERATIONS = 210_000;
const ADMIN_PASSWORD_HASH_BYTES = 32;
const ADMIN_PASSWORD_SALT_BYTES = 16;

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return toIsoString(value);
}

function getCryptoApi() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  return globalThis.crypto;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex value");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function deriveAdminPasswordHash(password: string, saltHex: string, iterations: number) {
  const cryptoApi = getCryptoApi();
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations,
    },
    key,
    ADMIN_PASSWORD_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function generateSaltHex() {
  const bytes = new Uint8Array(ADMIN_PASSWORD_SALT_BYTES);
  getCryptoApi().getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashAdminPassword(password: string) {
  const saltHex = generateSaltHex();
  const derived = await deriveAdminPasswordHash(password, saltHex, ADMIN_PASSWORD_HASH_ITERATIONS);
  return [
    ADMIN_PASSWORD_HASH_SCHEME,
    String(ADMIN_PASSWORD_HASH_ITERATIONS),
    saltHex,
    bytesToHex(derived),
  ].join("$");
}

async function verifyAdminPasswordHash(password: string, passwordHash: string) {
  const [scheme, iterationsRaw, saltHex, hashHex] = passwordHash.split("$");
  if (!scheme || !iterationsRaw || !saltHex || !hashHex) return false;
  if (scheme !== ADMIN_PASSWORD_HASH_SCHEME) return false;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const actual = await deriveAdminPasswordHash(password, saltHex, iterations);
  const expected = hexToBytes(hashHex);
  return timingSafeEqual(actual, expected);
}

async function checkPassword(password: string) {
  try {
    const [row] = await db
      .select({ passwordHash: adminCredentials.passwordHash })
      .from(adminCredentials)
      .where(eq(adminCredentials.singleton, true))
      .limit(1);

    if (row?.passwordHash) {
      const ok = await verifyAdminPasswordHash(password, row.passwordHash);
      if (!ok) throw new Error("Invalid admin password");
      return;
    }
  } catch (err) {
    // If table doesn't exist yet, fall back to environment variable
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }
  if (password !== expected) {
    throw new Error("Invalid admin password");
  }
}

async function markExpiredGrants() {
  const now = new Date();
  await db
    .update(grantedSubscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(grantedSubscriptions.status, "active"),
        isNotNull(grantedSubscriptions.expiresAt),
        lt(grantedSubscriptions.expiresAt, now),
      ),
    );
}

async function createMissingGrantsForApprovedRequests(requestIds: readonly string[]) {
  if (requestIds.length === 0) return 0;

  const requests = await db
    .select({
      id: subscriptionRequests.id,
      email: subscriptionRequests.email,
      name: subscriptionRequests.name,
      selectedServices: subscriptionRequests.selectedServices,
    })
    .from(subscriptionRequests)
    .where(
      and(
        inArray(subscriptionRequests.id, [...requestIds]),
        eq(subscriptionRequests.status, "approved"),
      ),
    );

  let createdCount = 0;

  for (const req of requests) {
    for (const serviceName of req.selectedServices) {
      const trimmed = serviceName.trim();
      if (!trimmed) continue;

      const existing = await db
        .select({ id: grantedSubscriptions.id })
        .from(grantedSubscriptions)
        .where(
          and(
            eq(grantedSubscriptions.requestId, req.id),
            sql`lower(${grantedSubscriptions.serviceName}) = lower(${trimmed})`,
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(grantedSubscriptions).values({
          email: req.email,
          name: req.name || null,
          serviceName: trimmed,
          requestId: req.id,
          status: "active",
          notes: AUTO_GRANT_NOTE,
        });
        createdCount += 1;
      }
    }
  }

  return createdCount;
}

function isRequestStatusEmailStatus(
  status: RequestStatus,
): status is "approved" | "rejected" | "contacted" {
  return status === "approved" || status === "rejected" || status === "contacted";
}

async function sendRequestStatusNotifications(
  rows: Array<{
    id: string;
    reference_code: string;
    name: string;
    email: string;
    selected_services: string[];
    status: RequestStatus;
    note: string | null;
  }>,
) {
  const jobs = rows
    .filter((row) => isRequestStatusEmailStatus(row.status))
    .map(async (row) => {
      try {
        await sendRequestStatusEmail({
          name: row.name,
          email: row.email,
          selectedServices: row.selected_services,
          referenceCode: row.reference_code,
          status: row.status,
          note: row.note,
        });
      } catch (error) {
        console.error(`Failed to send ${row.status} email for request ${row.id}:`, error);
      }
    });

  if (jobs.length > 0) {
    await Promise.allSettled(jobs);
  }
}

const pw = z.string().min(1).max(200);
const nextPw = z.string().min(8).max(200);
const timelineNote = z.string().trim().max(2000).nullable().optional();
const timelineChangedAt = z.string().datetime({ offset: true });
const colorClass = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9 _/:-]+$/, "Invalid color class");

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    return { ok: true as const };
  });

export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; nextPassword: string }) =>
    z.object({ password: pw, nextPassword: nextPw }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password === data.nextPassword) {
      throw new Error("Choose a different password");
    }

    await checkPassword(data.password);
    const passwordHash = await hashAdminPassword(data.nextPassword);

    await db
      .insert(adminCredentials)
      .values({
        singleton: true,
        passwordHash,
      })
      .onConflictDoUpdate({
        target: adminCredentials.singleton,
        set: { passwordHash, updatedAt: new Date() },
      });

    return { ok: true as const };
  });

export const listSubscriptionRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }): Promise<{ requests: AdminRequest[] }> => {
    await checkPassword(data.password);

    const rows = await db
      .select()
      .from(subscriptionRequests)
      .orderBy(desc(subscriptionRequests.createdAt));

    const ids = rows.map((r) => r.id);
    const historyMap = new Map<string, StatusHistoryEntry[]>();

    if (ids.length > 0) {
      const historyRows = await db
        .select()
        .from(requestStatusHistory)
        .where(inArray(requestStatusHistory.requestId, ids))
        .orderBy(asc(requestStatusHistory.changedAt));

      for (const h of historyRows) {
        const list = historyMap.get(h.requestId) ?? [];
        list.push({
          id: h.id,
          status: h.status as RequestStatus,
          changed_at: toIsoString(h.changedAt),
          note: h.note,
        });
        historyMap.set(h.requestId, list);
      }
    }

    const requests: AdminRequest[] = rows.map((row) => ({
      id: row.id,
      reference_code: row.referenceCode,
      name: row.name,
      email: row.email,
      company: row.company,
      selected_services: row.selectedServices,
      use_case: row.useCase,
      message: row.message,
      status: row.status as RequestStatus,
      created_at: toIsoString(row.createdAt),
      custom_fields: (row.customFields as Record<string, unknown>) || {},
      history: historyMap.get(row.id) ?? [
        {
          id: row.id,
          status: row.status as RequestStatus,
          changed_at: toIsoString(row.createdAt),
          note: null,
        },
      ],
      ai_score: row.aiScore,
      ai_recommendation: row.aiRecommendation,
      ai_analysis: row.aiAnalysis as AdminRequest["ai_analysis"],
    }));

    return { requests };
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string; status: RequestStatus }) =>
    z
      .object({
        password: pw,
        id: z.string().uuid(),
        status: z.enum(REQUEST_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const [row] = await db
      .select()
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.id, data.id))
      .limit(1);

    if (!row) throw new Error("Request not found");

    const shouldNotify = row.status !== data.status;

    await db
      .update(subscriptionRequests)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(subscriptionRequests.id, data.id));

    await db.insert(requestStatusHistory).values({
      requestId: data.id,
      status: data.status,
      note: null,
    });

    let createdGrants = 0;
    if (data.status === "approved") {
      createdGrants = await createMissingGrantsForApprovedRequests([data.id]);
    }

    if (shouldNotify) {
      await sendRequestStatusNotifications([
        {
          id: row.id,
          reference_code: row.referenceCode,
          name: row.name,
          email: row.email,
          selected_services: row.selectedServices,
          status: data.status,
          note: null,
        },
      ]);
    }

    return { ok: true as const, createdGrants };
  });

export const bulkUpdateRequestStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; ids: string[]; status: RequestStatus }) =>
    z
      .object({
        password: pw,
        ids: z.array(z.string().uuid()).min(1).max(500),
        status: z.enum(REQUEST_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const rows = await db
      .select()
      .from(subscriptionRequests)
      .where(inArray(subscriptionRequests.id, data.ids));

    if (rows.length === 0) {
      return { ok: true as const, updated: 0, createdGrants: 0 };
    }

    await db
      .update(subscriptionRequests)
      .set({ status: data.status, updatedAt: new Date() })
      .where(inArray(subscriptionRequests.id, data.ids));

    for (const r of rows) {
      if (r.status !== data.status) {
        await db.insert(requestStatusHistory).values({
          requestId: r.id,
          status: data.status,
          note: "Bulk status update",
        });
      }
    }

    let createdGrants = 0;
    if (data.status === "approved") {
      createdGrants = await createMissingGrantsForApprovedRequests(data.ids);
    }

    const notifications = rows
      .filter((r) => r.status !== data.status)
      .map((r) => ({
        id: r.id,
        reference_code: r.referenceCode,
        name: r.name,
        email: r.email,
        selected_services: r.selectedServices,
        status: data.status,
        note: null,
      }));

    await sendRequestStatusNotifications(notifications);

    return { ok: true as const, updated: rows.length, createdGrants };
  });

export const createRequestTimelineEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      password: string;
      requestId: string;
      status: RequestStatus;
      changedAt: string;
      note?: string | null;
    }) =>
      z
        .object({
          password: pw,
          requestId: z.string().uuid(),
          status: z.enum(REQUEST_STATUSES),
          changedAt: timelineChangedAt,
          note: timelineNote,
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const [request] = await db
      .select()
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.id, data.requestId))
      .limit(1);

    if (!request) throw new Error("Request not found");

    await db.insert(requestStatusHistory).values({
      requestId: data.requestId,
      status: data.status,
      changedAt: new Date(data.changedAt),
      note: data.note?.trim() || null,
    });

    await db
      .update(subscriptionRequests)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(subscriptionRequests.id, data.requestId));

    let createdGrants = 0;
    if (data.status === "approved") {
      createdGrants = await createMissingGrantsForApprovedRequests([data.requestId]);
    }

    await sendRequestStatusNotifications([
      {
        id: request.id,
        reference_code: request.referenceCode,
        name: request.name,
        email: request.email,
        selected_services: request.selectedServices,
        status: data.status,
        note: data.note?.trim() || null,
      },
    ]);

    return { ok: true as const, createdGrants };
  });

export const updateRequestTimelineEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      password: string;
      requestId: string;
      entryId: string;
      status: RequestStatus;
      changedAt: string;
      note?: string | null;
    }) =>
      z
        .object({
          password: pw,
          requestId: z.string().uuid(),
          entryId: z.string().uuid(),
          status: z.enum(REQUEST_STATUSES),
          changedAt: timelineChangedAt,
          note: timelineNote,
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    await db
      .update(requestStatusHistory)
      .set({
        status: data.status,
        changedAt: new Date(data.changedAt),
        note: data.note?.trim() || null,
      })
      .where(
        and(
          eq(requestStatusHistory.id, data.entryId),
          eq(requestStatusHistory.requestId, data.requestId),
        ),
      );

    return { ok: true as const };
  });

export const deleteRequestTimelineEntry = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; requestId: string; entryId: string }) =>
    z
      .object({
        password: pw,
        requestId: z.string().uuid(),
        entryId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const history = await db
      .select({ id: requestStatusHistory.id })
      .from(requestStatusHistory)
      .where(eq(requestStatusHistory.requestId, data.requestId));

    if (history.length <= 1) {
      throw new Error("A request must keep at least one timeline entry");
    }

    await db
      .delete(requestStatusHistory)
      .where(
        and(
          eq(requestStatusHistory.id, data.entryId),
          eq(requestStatusHistory.requestId, data.requestId),
        ),
      );

    return { ok: true as const };
  });

export const sendRequestUpdateEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const [row] = await db
      .select()
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.id, data.id))
      .limit(1);

    if (!row) throw new Error("Request not found");

    if (!isRequestStatusEmailStatus(row.status as RequestStatus)) {
      throw new Error("Pending requests do not have an update email yet");
    }

    const [latestHistory] = await db
      .select({ note: requestStatusHistory.note })
      .from(requestStatusHistory)
      .where(eq(requestStatusHistory.requestId, row.id))
      .orderBy(desc(requestStatusHistory.changedAt))
      .limit(1);

    const result = await sendRequestStatusEmail({
      name: row.name,
      email: row.email,
      selectedServices: row.selectedServices,
      referenceCode: row.referenceCode,
      status: row.status as "approved" | "rejected" | "contacted",
      note: latestHistory?.note ?? null,
    });

    if (result.skipped) {
      throw new Error("Resend is not configured");
    }

    return { ok: true as const };
  });

export const deleteRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db.delete(subscriptionRequests).where(eq(subscriptionRequests.id, data.id));
    return { ok: true as const };
  });

export const bulkDeleteRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; ids: string[] }) =>
    z
      .object({
        password: pw,
        ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db.delete(subscriptionRequests).where(inArray(subscriptionRequests.id, data.ids));
    return { ok: true as const, deleted: data.ids.length };
  });

// Trigger AI Triage On-Demand for any existing request
export const triggerAiTriageForRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const [row] = await db
      .select()
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.id, data.id))
      .limit(1);

    if (!row) throw new Error("Request not found");

    const triage = await analyzeSubscriptionRequest({
      name: row.name,
      email: row.email,
      selectedServices: row.selectedServices,
      company: row.company,
      useCase: row.useCase,
      message: row.message,
    });

    await db
      .update(subscriptionRequests)
      .set({
        aiScore: triage.score,
        aiRecommendation: triage.recommendation,
        aiAnalysis: triage,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionRequests.id, data.id));

    return { ok: true as const, triage };
  });

export const listServices = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }): Promise<{ services: AdminService[] }> => {
    await checkPassword(data.password);
    const rows = await db
      .select({
        id: services.id,
        slug: services.slug,
        name: services.name,
        category: services.category,
        emoji: services.emoji,
        bg_class: services.bgClass,
        description: services.description,
        is_active: services.isActive,
        sort_order: services.sortOrder,
      })
      .from(services)
      .orderBy(asc(services.sortOrder));

    return { services: rows };
  });

const serviceInput = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes"),
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8),
  bg_class: colorClass,
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(100000),
});

export const createService = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; service: z.infer<typeof serviceInput> }) =>
    z.object({ password: pw, service: serviceInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    try {
      await db.insert(services).values({
        slug: data.service.slug,
        name: data.service.name,
        category: data.service.category,
        emoji: data.service.emoji,
        bgClass: data.service.bg_class,
        description: data.service.description,
        isActive: data.service.is_active,
        sortOrder: data.service.sort_order,
      });
    } catch (error: unknown) {
      if (
        (error && typeof error === "object" && "code" in error && error.code === "23505") ||
        String(error).includes("duplicate key")
      ) {
        throw new Error("That slug already exists");
      }
      throw new Error("Failed to create service");
    }
    return { ok: true as const };
  });

export const updateService = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { password: string; id: string; service: z.infer<typeof serviceInput> }) =>
      z.object({ password: pw, id: z.string().uuid(), service: serviceInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    try {
      await db
        .update(services)
        .set({
          slug: data.service.slug,
          name: data.service.name,
          category: data.service.category,
          emoji: data.service.emoji,
          bgClass: data.service.bg_class,
          description: data.service.description,
          isActive: data.service.is_active,
          sortOrder: data.service.sort_order,
          updatedAt: new Date(),
        })
        .where(eq(services.id, data.id));
    } catch (error: unknown) {
      if (
        (error && typeof error === "object" && "code" in error && error.code === "23505") ||
        String(error).includes("duplicate key")
      ) {
        throw new Error("That slug already exists");
      }
      throw new Error("Failed to update service");
    }
    return { ok: true as const };
  });

export const deleteService = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db.delete(services).where(eq(services.id, data.id));
    return { ok: true as const };
  });

export const listFormFields = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }): Promise<{ fields: AdminFormField[] }> => {
    await checkPassword(data.password);
    const rows = await db
      .select({
        id: formFields.id,
        field_key: formFields.fieldKey,
        label: formFields.label,
        field_type: formFields.fieldType,
        placeholder: formFields.placeholder,
        help_text: formFields.helpText,
        options: formFields.options,
        is_required: formFields.isRequired,
        is_active: formFields.isActive,
        is_builtin: formFields.isBuiltin,
        max_length: formFields.maxLength,
        sort_order: formFields.sortOrder,
      })
      .from(formFields)
      .orderBy(asc(formFields.sortOrder));

    return { fields: rows as AdminFormField[] };
  });

const fieldInput = z.object({
  field_key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores"),
  label: z.string().min(1).max(120),
  field_type: z.enum(FIELD_TYPES),
  placeholder: z.string().max(200).optional().nullable(),
  help_text: z.string().max(300).optional().nullable(),
  options: z.array(z.string().min(1).max(80)).max(40).default([]),
  is_required: z.boolean(),
  is_active: z.boolean(),
  max_length: z.number().int().min(1).max(5000),
  sort_order: z.number().int().min(0).max(100000),
});

export const createFormField = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; field: z.infer<typeof fieldInput> }) =>
    z.object({ password: pw, field: fieldInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    try {
      await db.insert(formFields).values({
        fieldKey: data.field.field_key,
        label: data.field.label,
        fieldType: data.field.field_type,
        placeholder: data.field.placeholder,
        helpText: data.field.help_text,
        options: data.field.options,
        isRequired: data.field.is_required,
        isActive: data.field.is_active,
        isBuiltin: false,
        maxLength: data.field.max_length,
        sortOrder: data.field.sort_order,
      });
    } catch (error: unknown) {
      if (
        (error && typeof error === "object" && "code" in error && error.code === "23505") ||
        String(error).includes("duplicate key")
      ) {
        throw new Error("That field key already exists");
      }
      throw new Error("Failed to create field");
    }
    return { ok: true as const };
  });

export const updateFormField = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string; field: z.infer<typeof fieldInput> }) =>
    z.object({ password: pw, id: z.string().uuid(), field: fieldInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);

    const [existing] = await db
      .select({ isBuiltin: formFields.isBuiltin })
      .from(formFields)
      .where(eq(formFields.id, data.id))
      .limit(1);

    if (!existing) throw new Error("Field not found");

    if (existing.isBuiltin) {
      await db
        .update(formFields)
        .set({
          label: data.field.label,
          placeholder: data.field.placeholder,
          helpText: data.field.help_text,
          isRequired: data.field.is_required,
          isActive: data.field.is_active,
          sortOrder: data.field.sort_order,
          updatedAt: new Date(),
        })
        .where(eq(formFields.id, data.id));
      return { ok: true as const };
    }

    try {
      await db
        .update(formFields)
        .set({
          fieldKey: data.field.field_key,
          label: data.field.label,
          fieldType: data.field.field_type,
          placeholder: data.field.placeholder,
          helpText: data.field.help_text,
          options: data.field.options,
          isRequired: data.field.is_required,
          isActive: data.field.is_active,
          maxLength: data.field.max_length,
          sortOrder: data.field.sort_order,
          updatedAt: new Date(),
        })
        .where(eq(formFields.id, data.id));
    } catch (error: unknown) {
      if (
        (error && typeof error === "object" && "code" in error && error.code === "23505") ||
        String(error).includes("duplicate key")
      ) {
        throw new Error("That field key already exists");
      }
      throw new Error("Failed to update field");
    }
    return { ok: true as const };
  });

export const deleteFormField = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const [existing] = await db
      .select({ isBuiltin: formFields.isBuiltin })
      .from(formFields)
      .where(eq(formFields.id, data.id))
      .limit(1);

    if (existing?.isBuiltin) {
      throw new Error("Built-in fields can be disabled but not deleted");
    }

    await db.delete(formFields).where(eq(formFields.id, data.id));
    return { ok: true as const };
  });

export const listGrants = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }): Promise<{ grants: AdminGrant[] }> => {
    await checkPassword(data.password);
    await markExpiredGrants();

    const rows = await db
      .select()
      .from(grantedSubscriptions)
      .orderBy(desc(grantedSubscriptions.grantedAt));

    return {
      grants: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        service_name: r.serviceName,
        request_id: r.requestId,
        granted_at: toIsoString(r.grantedAt),
        expires_at: toNullableIsoString(r.expiresAt),
        status: r.status as GrantStatus,
        notes: r.notes,
      })),
    };
  });

const grantInput = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(100).optional().nullable(),
  service_name: z.string().min(1).max(80),
  request_id: z.string().uuid().optional().nullable(),
  granted_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional().nullable(),
  status: z.enum(GRANT_STATUSES),
  notes: z.string().max(1000).optional().nullable(),
});

export const createGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; grant: z.infer<typeof grantInput> }) =>
    z.object({ password: pw, grant: grantInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db.insert(grantedSubscriptions).values({
      email: data.grant.email,
      name: data.grant.name ?? null,
      serviceName: data.grant.service_name,
      requestId: data.grant.request_id ?? null,
      grantedAt: data.grant.granted_at ? new Date(data.grant.granted_at) : new Date(),
      expiresAt: data.grant.expires_at ? new Date(data.grant.expires_at) : null,
      status: data.grant.status,
      notes: data.grant.notes ?? null,
    });
    return { ok: true as const };
  });

export const updateGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string; grant: z.infer<typeof grantInput> }) =>
    z.object({ password: pw, id: z.string().uuid(), grant: grantInput }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db
      .update(grantedSubscriptions)
      .set({
        email: data.grant.email,
        name: data.grant.name ?? null,
        serviceName: data.grant.service_name,
        requestId: data.grant.request_id ?? null,
        grantedAt: data.grant.granted_at ? new Date(data.grant.granted_at) : new Date(),
        expiresAt: data.grant.expires_at ? new Date(data.grant.expires_at) : null,
        status: data.grant.status,
        notes: data.grant.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(grantedSubscriptions.id, data.id));

    return { ok: true as const };
  });

export const deleteGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; id: string }) =>
    z.object({ password: pw, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    await db.delete(grantedSubscriptions).where(eq(grantedSubscriptions.id, data.id));
    return { ok: true as const };
  });

export const listRequesters = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => z.object({ password: pw }).parse(input))
  .handler(async ({ data }): Promise<{ requesters: AdminRequester[] }> => {
    await checkPassword(data.password);

    const [requestsList, grantsList] = await Promise.all([
      db
        .select({
          name: subscriptionRequests.name,
          email: subscriptionRequests.email,
          company: subscriptionRequests.company,
          createdAt: subscriptionRequests.createdAt,
        })
        .from(subscriptionRequests),
      db
        .select({
          email: grantedSubscriptions.email,
          status: grantedSubscriptions.status,
        })
        .from(grantedSubscriptions),
    ]);

    const map = new Map<string, AdminRequester>();
    for (const request of requestsList) {
      const key = request.email.toLowerCase();
      const current =
        map.get(key) ??
        ({
          email: request.email,
          name: request.name,
          company: request.company,
          request_count: 0,
          last_request_at: toIsoString(request.createdAt),
          active_grants: 0,
          expired_grants: 0,
        } as AdminRequester);
      current.request_count += 1;
      if (new Date(request.createdAt) > new Date(current.last_request_at)) {
        current.last_request_at = toIsoString(request.createdAt);
        current.name = request.name;
        current.company = request.company;
      }
      map.set(key, current);
    }

    for (const grant of grantsList) {
      const key = grant.email.toLowerCase();
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          email: grant.email,
          name: "(grant only)",
          company: null,
          request_count: 0,
          last_request_at: new Date(0).toISOString(),
          active_grants: grant.status === "active" ? 1 : 0,
          expired_grants: grant.status === "expired" ? 1 : 0,
        });
      } else {
        if (grant.status === "active") current.active_grants += 1;
        if (grant.status === "expired") current.expired_grants += 1;
      }
    }

    const requesters = Array.from(map.values()).sort(
      (a, b) => new Date(b.last_request_at).getTime() - new Date(a.last_request_at).getTime(),
    );

    return { requesters };
  });

export const deleteRequesterByEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; email: string }) =>
    z.object({ password: pw, email: z.string().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const email = data.email.toLowerCase();

    await db
      .delete(subscriptionRequests)
      .where(sql`lower(${subscriptionRequests.email}) = ${email}`);

    await db
      .delete(grantedSubscriptions)
      .where(sql`lower(${grantedSubscriptions.email}) = ${email}`);

    return { ok: true as const };
  });
