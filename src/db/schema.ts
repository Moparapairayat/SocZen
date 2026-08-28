import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "contacted",
]);

export const formFieldTypeEnum = pgEnum("form_field_type", [
  "text",
  "textarea",
  "email",
  "select",
  "checkbox",
]);

export const grantStatusEnum = pgEnum("grant_status", [
  "active",
  "expired",
  "revoked",
]);

export const subscriptionRequests = pgTable(
  "subscription_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceCode: text("reference_code").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    selectedServices: text("selected_services")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    useCase: text("use_case"),
    message: text("message"),
    status: requestStatusEnum("status").notNull().default("pending"),
    customFields: jsonb("custom_fields").notNull().default({}),
    // AI Triage fields
    aiScore: integer("ai_score"),
    aiRecommendation: text("ai_recommendation"), // 'approve' | 'review' | 'reject'
    aiAnalysis: jsonb("ai_analysis"), // { score, reason, summary, riskLevel, confidence }
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_subscription_requests_created_at").on(table.createdAt),
    index("idx_subscription_requests_status").on(table.status),
    uniqueIndex("idx_subscription_requests_reference_code").on(table.referenceCode),
    index("idx_subscription_requests_email").on(table.email),
  ]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    emoji: text("emoji").notNull().default("✨"),
    bgClass: text("bg_class").notNull().default("bg-brand-lime"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_services_active_sort").on(table.isActive, table.sortOrder),
  ]
);

export const formFields = pgTable(
  "form_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldKey: text("field_key").notNull().unique(),
    label: text("label").notNull(),
    fieldType: formFieldTypeEnum("field_type").notNull().default("text"),
    placeholder: text("placeholder"),
    helpText: text("help_text"),
    options: text("options")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isRequired: boolean("is_required").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    maxLength: integer("max_length").notNull().default(1000),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_form_fields_active_sort").on(table.isActive, table.sortOrder),
  ]
);

export const grantedSubscriptions = pgTable(
  "granted_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    serviceName: text("service_name").notNull(),
    requestId: uuid("request_id").references(() => subscriptionRequests.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: grantStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_grants_email").on(table.email),
    index("idx_grants_expires").on(table.expiresAt),
    index("idx_grants_status").on(table.status),
  ]
);

export const requestStatusHistory = pgTable(
  "request_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => subscriptionRequests.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),
  },
  (table) => [
    index("idx_request_status_history_request_id").on(
      table.requestId,
      table.changedAt
    ),
  ]
);

export const adminCredentials = pgTable("admin_credentials", {
  singleton: boolean("singleton").primaryKey().default(true),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const subscriptionRequestsRelations = relations(
  subscriptionRequests,
  ({ many }) => ({
    history: many(requestStatusHistory),
    grants: many(grantedSubscriptions),
  })
);

export const requestStatusHistoryRelations = relations(
  requestStatusHistory,
  ({ one }) => ({
    request: one(subscriptionRequests, {
      fields: [requestStatusHistory.requestId],
      references: [subscriptionRequests.id],
    }),
  })
);

export const grantedSubscriptionsRelations = relations(
  grantedSubscriptions,
  ({ one }) => ({
    request: one(subscriptionRequests, {
      fields: [grantedSubscriptions.requestId],
      references: [subscriptionRequests.id],
    }),
  })
);

// Types
export type SubscriptionRequest = typeof subscriptionRequests.$inferSelect;
export type NewSubscriptionRequest = typeof subscriptionRequests.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type FormField = typeof formFields.$inferSelect;
export type NewFormField = typeof formFields.$inferInsert;
export type GrantedSubscription = typeof grantedSubscriptions.$inferSelect;
export type NewGrantedSubscription = typeof grantedSubscriptions.$inferInsert;
export type RequestStatusHistory = typeof requestStatusHistory.$inferSelect;
export type NewRequestStatusHistory = typeof requestStatusHistory.$inferInsert;
export type AdminCredential = typeof adminCredentials.$inferSelect;

