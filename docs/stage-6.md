# Stage 6 — Indexing Pipeline and Incremental Updates (M2)

**Goal:** Index a registered repository end to end: discover, chunk, embed, persist; re-index incrementally and idempotently.

**Status:** Done (CAA-7, PR #6). Follow-ups: shutdown hooks (PR #7)

**Prerequisites:** Stages 2, 3, 4, 5.

## Tasks

1. Index job model in the API process (no Redis/worker): `index_jobs` row with status (`queued`, `running`, `succeeded`, `failed`), counters (files seen/indexed/skipped/failed, chunks), timestamps, sanitized error summary. Only one active job per repository.
2. `POST /codebases/:id/index` starts a job and returns the job ID; `GET /codebases/:id/index-jobs/latest` (or similar) reports progress and per-file skip/error reasons (no contents).
3. Pipeline per file:
   - Compare file content hash with `repository_files`; skip unchanged files when `embedding_model` and `chunking_version` match.
   - Re-chunk changed files; reuse embeddings for chunks with the same `chunk_hash`; embed only new chunks in batches through `EmbeddingsService` (never a runtime adapter).
   - Upsert chunks inside a transaction per file.
4. Remove stale records for deleted or renamed files and for chunks that no longer exist.
5. Force re-index when the embedding identity or chunking version changes. Store the identity as `<runtime>/<model>` (for example `ollama/nomic-embed-text`) in `embedding_model`, so switching `INFERENCE_RUNTIME` also re-indexes (decision 0005).
6. Concurrency limit for embedding calls (config); cancellation on repository deletion.
7. On API restart, mark orphaned `running` jobs as `failed`.
8. Observability: log IDs, counts, timings only.

## Tests

- Integration with fixture repo and a fake `EMBEDDING_PORT`: first index creates expected chunks; second index creates no duplicates and makes zero embedding calls.
- Modified file re-embeds only changed chunks; deleted file removes its chunks; renamed file handled.
- Model/chunking version change triggers a full re-embed.
- Embedder failure marks the file/job failed with a sanitized message; partial progress consistent.
- Canary secret file is never indexed and never appears in DB or logs.

## Definition of Done

- A real small repository (indexed with real Ollama) completes; progress is queryable.
- Idempotency and incremental tests pass.

## Related items

- [Database pool and statement timeout](local/improvements/003-database-pool-and-statement-timeout.md)
- [Index job time limit](local/improvements/004-index-job-time-limit.md)
