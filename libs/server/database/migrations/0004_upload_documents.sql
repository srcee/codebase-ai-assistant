CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"logical_path" text NOT NULL,
	"blob_hash" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"media_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_size_check" CHECK ("documents"."size_bytes" >= 0),
	CONSTRAINT "documents_blob_hash_check" CHECK ("documents"."blob_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "canonical_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_source_path_key" ON "documents" USING btree ("source_id",lower("logical_path"));--> statement-breakpoint
CREATE INDEX "documents_blob_hash_idx" ON "documents" USING btree ("blob_hash");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_canonical_path_check" CHECK (("sources"."origin" is not distinct from 'upload') = ("sources"."canonical_path" is null));