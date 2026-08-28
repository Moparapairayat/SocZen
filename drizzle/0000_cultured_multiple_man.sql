CREATE TYPE "public"."form_field_type" AS ENUM('text', 'textarea', 'email', 'select', 'checkbox');--> statement-breakpoint
CREATE TYPE "public"."grant_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'contacted');--> statement-breakpoint
CREATE TABLE "admin_credentials" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" "form_field_type" DEFAULT 'text' NOT NULL,
	"placeholder" text,
	"help_text" text,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"max_length" integer DEFAULT 1000 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_fields_field_key_unique" UNIQUE("field_key")
);
--> statement-breakpoint
CREATE TABLE "granted_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"service_name" text NOT NULL,
	"request_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" "grant_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "request_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"emoji" text DEFAULT '✨' NOT NULL,
	"bg_class" text DEFAULT 'bg-brand-lime' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"selected_services" text[] DEFAULT '{}'::text[] NOT NULL,
	"use_case" text,
	"message" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_score" integer,
	"ai_recommendation" text,
	"ai_analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "granted_subscriptions" ADD CONSTRAINT "granted_subscriptions_request_id_subscription_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."subscription_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_subscription_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."subscription_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_form_fields_active_sort" ON "form_fields" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_grants_email" ON "granted_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_grants_expires" ON "granted_subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_grants_status" ON "granted_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_request_status_history_request_id" ON "request_status_history" USING btree ("request_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_services_active_sort" ON "services" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_subscription_requests_created_at" ON "subscription_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_requests_status" ON "subscription_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscription_requests_reference_code" ON "subscription_requests" USING btree ("reference_code");--> statement-breakpoint
CREATE INDEX "idx_subscription_requests_email" ON "subscription_requests" USING btree ("email");