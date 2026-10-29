ALTER TABLE "repository_files" ALTER COLUMN "content_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "repository_files" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "repository_files" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "repository_files" ADD COLUMN "chunking_version" text;--> statement-breakpoint
CREATE UNIQUE INDEX "index_jobs_one_active_per_repository_key" ON "index_jobs" USING btree ("repository_id") WHERE "index_jobs"."status" in ('queued', 'running');--> statement-breakpoint
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_content_hash_check" CHECK ("repository_files"."status" = 'skipped' or "repository_files"."content_hash" is not null);