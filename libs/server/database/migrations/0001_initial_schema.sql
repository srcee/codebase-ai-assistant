CREATE TABLE "code_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_hash" text NOT NULL,
	"symbol_name" text,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"content" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(symbol_name, '') || ' ' || content)) STORED,
	"embedding" vector(768) NOT NULL,
	"embedding_model" text NOT NULL,
	"chunking_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "code_chunks_lines_check" CHECK ("code_chunks"."start_line" >= 1 and "code_chunks"."end_line" >= "code_chunks"."start_line")
);
--> statement-breakpoint
CREATE TABLE "index_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
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
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"canonical_path" text NOT NULL,
	"privacy_mode" text DEFAULT 'local' NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"last_indexed_commit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_canonical_path_unique" UNIQUE("canonical_path"),
	CONSTRAINT "repositories_privacy_mode_check" CHECK ("repositories"."privacy_mode" in ('local')),
	CONSTRAINT "repositories_status_check" CHECK ("repositories"."status" in ('registered', 'indexing', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "repository_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"relative_path" text NOT NULL,
	"content_hash" text NOT NULL,
	"language" text,
	"size_bytes" bigint NOT NULL,
	"status" text NOT NULL,
	"status_reason" text,
	"last_indexed_at" timestamp with time zone,
	CONSTRAINT "repository_files_repository_path_key" UNIQUE("repository_id","relative_path"),
	CONSTRAINT "repository_files_id_repository_key" UNIQUE("id","repository_id"),
	CONSTRAINT "repository_files_size_check" CHECK ("repository_files"."size_bytes" >= 0),
	CONSTRAINT "repository_files_status_check" CHECK ("repository_files"."status" in ('indexed', 'skipped', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_file_repository_fkey" FOREIGN KEY ("file_id","repository_id") REFERENCES "public"."repository_files"("id","repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_chunks_repository_idx" ON "code_chunks" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "code_chunks_file_idx" ON "code_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "code_chunks_chunk_hash_idx" ON "code_chunks" USING btree ("chunk_hash");--> statement-breakpoint
CREATE INDEX "code_chunks_search_vector_idx" ON "code_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "code_chunks_embedding_hnsw_idx" ON "code_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "index_jobs_repository_idx" ON "index_jobs" USING btree ("repository_id");