CREATE TABLE "restaurant_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_url" text,
	"observed_at" timestamp with time zone NOT NULL,
	"text" text NOT NULL,
	"attachment" jsonb,
	"sha256" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurant_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "restaurant_fact_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"facts" jsonb NOT NULL,
	"confirmed_by" text NOT NULL,
	"confirmed_by_name" text NOT NULL,
	"verified_with" text NOT NULL,
	"note" text NOT NULL,
	"sha256" text NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurant_fact_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "restaurant_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" text NOT NULL,
	"label" text NOT NULL,
	"draft" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurant_stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "restaurant_evidence" ADD CONSTRAINT "restaurant_evidence_store_id_restaurant_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."restaurant_stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_fact_versions" ADD CONSTRAINT "restaurant_fact_versions_store_id_restaurant_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."restaurant_stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_stores" ADD CONSTRAINT "restaurant_stores_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "restaurant_evidence_store_idx" ON "restaurant_evidence" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_fact_version_idx" ON "restaurant_fact_versions" USING btree ("store_id","version");--> statement-breakpoint
CREATE INDEX "restaurant_stores_brand_idx" ON "restaurant_stores" USING btree ("brand_id");
--> statement-breakpoint
-- Audit records are append-only, including when a caller bypasses the application.
CREATE FUNCTION restaurant_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Restaurant evidence and fact versions are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER restaurant_versions_immutable BEFORE UPDATE OR DELETE ON restaurant_fact_versions
FOR EACH ROW EXECUTE FUNCTION restaurant_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER restaurant_evidence_immutable BEFORE UPDATE OR DELETE ON restaurant_evidence
FOR EACH ROW EXECUTE FUNCTION restaurant_reject_mutation();
