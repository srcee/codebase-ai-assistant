# 0006: Indexing jobs and incremental updates

Status: accepted (CAA-7)

## Context

Stage 6 stores what ingestion produces and keeps it current. There is no queue or worker process, a repository can be deleted while it is indexed, and the API can stop mid-job. Embedding calls are the expensive part, so re-indexing must avoid them whenever the result would be the same.

## Decision

- **Jobs run in the API process.** `POST /codebases/:id/index` inserts an `index_jobs` row and returns `202`; `IndexJobRunnerService` runs the job in the background. A partial unique index on `index_jobs(repository_id) where status in ('queued', 'running')` allows one active job per repository, so a second request gets `409` without an in-memory lock.
- **Per-file state lives in `repository_files`.** Indexed, failed, and skipped files all have a row. Skipped rows carry the skip reason and no content hash or size (`content_hash` is nullable only when `status = 'skipped'`). The latest job reports counters; per-file reasons come from these rows. Excluded directories are not walked and have no row.
- **Unchanged detection.** `repository_files` stores `embedding_model` and `chunking_version` next to `content_hash`. A file is unchanged only if all three match, so changing `INFERENCE_RUNTIME`, `EMBEDDING_MODEL`, or `CHUNKING_VERSION` re-indexes everything.
- **Embedding identity** is `<runtime>/<model>` from `EmbeddingsService.identity`, stored on files and chunks.
- **Embedding reuse.** Before embedding a changed file, vectors are looked up by `chunk_hash`, identity, and chunking version within the same repository only. Only missing hashes are embedded. Stale rows are deleted after the walk, so a renamed file finds its old vectors.
- **One transaction per file.** The file row is upserted and its chunks replaced together. Chunk ids change when a file changes.
- **Failures.** A request the runtime rejects (for example input over the model context) fails that file only; its identity is cleared so the next run retries it. Any other error (inference unavailable, missing model, dimension mismatch, root moved or rejected, database error) fails the job. The job keeps a fixed summary: the message of an error class known to carry only reason codes, otherwise `Indexing failed: <ErrorName>`. Files finished before the failure stay consistent, and stale rows are not removed after a failed walk.
- **Concurrency.** `INDEXING_EMBED_CONCURRENCY` (1 to 8, default 2) files are processed in parallel within a job; discovery is consumed lazily so memory stays bounded.
- **Cancellation.** Before each file the runner checks that the repository still exists; if not, it aborts in-flight embedding requests and stops. Foreign keys cascade the delete, so the codebases module needs no reference to the runner and the modules stay acyclic. On shutdown (SIGINT or SIGTERM, enabled in `main.ts`) the runner aborts its jobs and waits for them to be recorded as failed in `beforeApplicationShutdown`, before the database pool closes.
- **Restart recovery.** On bootstrap, any `queued` or `running` job is marked `failed` (`Interrupted by an API restart.`) and repositories left in `indexing` become `failed`.
- **Repository status** follows the job: `indexing` while active, then `ready` or `failed`.
- **Logging** is one line per job with ids, counters, and duration.

## Consequences

- A job can run after the HTTP request ends and is lost on restart; a queue becomes worth it only with multiple processes.
- Cancellation takes effect between files, so one in-flight file may finish embedding before the job stops; its write then fails on the foreign key.
- Changing `CHUNK_MAX_CHARS` or `CHUNK_OVERLAP_CHARS` changes chunks but not `CHUNKING_VERSION`; changed files re-chunk on content change only.
- There is still no cap on files per job (see decision 0004).
- `lastIndexedCommit` stays empty: reading it would mean running git or parsing `.git`, which is out of scope.
