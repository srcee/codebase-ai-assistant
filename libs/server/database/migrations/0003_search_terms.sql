ALTER TABLE "code_chunks" ADD COLUMN "search_terms" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "code_chunks" DROP COLUMN "search_vector";--> statement-breakpoint
ALTER TABLE "code_chunks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(symbol_name, '')), 'A') || to_tsvector('simple', content) || setweight(to_tsvector('simple', search_terms), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "code_chunks_search_vector_idx" ON "code_chunks" USING gin ("search_vector");