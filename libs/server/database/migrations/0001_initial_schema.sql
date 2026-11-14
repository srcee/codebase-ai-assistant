CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_hash" text NOT NULL,
	"title" text,
	"content_kind" text NOT NULL,
	"locator" jsonb NOT NULL,
	"start_line" integer,
	"end_line" integer,
	"content" text NOT NULL,
	"search_terms" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || to_tsvector('simple', content) || setweight(to_tsvector('simple', search_terms), 'C')) STORED,
	"embedding" vector(768) NOT NULL,
	"embedding_model" text NOT NULL,
	"chunking_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chunks_lines_check" CHECK (("chunks"."start_line" is null and "chunks"."end_line" is null) or ("chunks"."start_line" is not null and "chunks"."end_line" is not null and "chunks"."start_line" >= 1 and "chunks"."end_line" >= "chunks"."start_line")),
	CONSTRAINT "chunks_content_kind_check" CHECK ("chunks"."content_kind" in ('code', 'prose', 'table_rows', 'schema_entity', 'image_description')),
	CONSTRAINT "chunks_locator_kind_check" CHECK ("chunks"."locator"->>'kind' is not null and "chunks"."locator"->>'kind' in ('lines', 'section', 'page', 'table_rows', 'schema_entity', 'image'))
);
--> statement-breakpoint
CREATE TABLE "index_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"files_discovered" integer DEFAULT 0 NOT NULL,
	"files_indexed" integer DEFAULT 0 NOT NULL,
	"files_skipped" integer DEFAULT 0 NOT NULL,
	"files_failed" integer DEFAULT 0 NOT NULL,
	"chunks_written" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "index_jobs_status_check" CHECK ("index_jobs"."status" in ('queued', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "project_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sources_project_source_key" UNIQUE("project_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"relative_path" text NOT NULL,
	"content_hash" text,
	"language" text,
	"size_bytes" bigint,
	"status" text NOT NULL,
	"status_reason" text,
	"embedding_model" text,
	"chunking_version" text,
	"last_indexed_at" timestamp with time zone,
	CONSTRAINT "source_files_source_path_key" UNIQUE("source_id","relative_path"),
	CONSTRAINT "source_files_id_source_key" UNIQUE("id","source_id"),
	CONSTRAINT "source_files_size_check" CHECK ("source_files"."size_bytes" >= 0),
	CONSTRAINT "source_files_status_check" CHECK ("source_files"."status" in ('indexed', 'skipped', 'failed')),
	CONSTRAINT "source_files_content_hash_check" CHECK ("source_files"."status" = 'skipped' or "source_files"."content_hash" is not null)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'code_repository' NOT NULL,
	"origin" text,
	"canonical_path" text NOT NULL,
	"privacy_mode" text DEFAULT 'local' NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"last_indexed_commit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_canonical_path_unique" UNIQUE("canonical_path"),
	CONSTRAINT "sources_kind_check" CHECK ("sources"."kind" in ('code_repository', 'document_collection')),
	CONSTRAINT "sources_origin_check" CHECK ("sources"."origin" in ('folder', 'upload')),
	CONSTRAINT "sources_document_collection_origin_check" CHECK ("sources"."kind" <> 'document_collection' or "sources"."origin" is not null),
	CONSTRAINT "sources_privacy_mode_check" CHECK ("sources"."privacy_mode" in ('local')),
	CONSTRAINT "sources_status_check" CHECK ("sources"."status" in ('registered', 'indexing', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_source_fkey" FOREIGN KEY ("file_id","source_id") REFERENCES "public"."source_files"("id","source_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_source_idx" ON "chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "chunks_file_idx" ON "chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "chunks_chunk_hash_idx" ON "chunks" USING btree ("chunk_hash");--> statement-breakpoint
CREATE INDEX "chunks_search_vector_idx" ON "chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "index_jobs_source_idx" ON "index_jobs" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "index_jobs_one_active_per_source_key" ON "index_jobs" USING btree ("source_id") WHERE "index_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "project_sources_source_idx" ON "project_sources" USING btree ("source_id");