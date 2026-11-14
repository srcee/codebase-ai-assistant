# 0011: Parsing worker pool

Status: proposed (Stage 10)

## Context

Code files are small text and are chunked in the API thread. Documents are different: PDF, DOCX, and XLSX parsing is CPU-heavy and synchronous in most libraries, files can be tens of megabytes, and a malformed file can hang a parser or use a lot of memory. Running that in the API thread would block HTTP requests and health checks during a sync, and one bad file could take the process down.

## Decision

- **A fixed pool of `node:worker_threads`**, owned by the document ingestion module, with no new dependency. Size `PARSE_WORKERS`, default `min(availableParallelism() - 1, 4)`, at least 1. Workers are reused, because starting a worker and loading a parser library per file costs more than the parse of a small file.
- **Routing.**
  - Binary formats (PDF, DOCX, XLSX, images) always run in the pool, whatever their size.
  - Text formats (Markdown, TXT, CSV, HTML, JSON, YAML, SQL, GraphQL) run inline up to `PARSE_INLINE_MAX_BYTES` (default 1 MiB) and in the pool above it.
  - Code ingestion is unchanged and stays inline.
- **Workers only parse and chunk.** Input is the file bytes (transferred, not copied) and the format. Output is chunks with text, title, content kind, and locator. Workers have no database, no network, no inference, and no logger. Embedding and vision calls stay in the main thread through `EmbeddingsService` and the ports, so the egress policy has one place to enforce.
- **Limits per task.** `PARSE_TIMEOUT_MS` (default 60000) and `resourceLimits.maxOldGenerationSizeMb` from `PARSE_WORKER_MAX_MEMORY_MB` (default 512). A timeout, crash, or out-of-memory terminates that worker, fails that file with a reason code (`parse_timeout`, `parse_crashed`, `parse_failed`), and starts a replacement. The job continues.
- **Back-pressure.** The pool queue is bounded by `INDEXING_EMBED_CONCURRENCY` files per job, so a large folder does not load every file into memory.
- **Shutdown.** The pool terminates its workers in `beforeApplicationShutdown`, after the index runner has aborted its jobs.
- **Build.** The worker entry is a separate webpack entry next to `main.ts`. Tests run the same entry, so specs do not mock the pool.

## Consequences

- Each worker loads its parser libraries once, so memory grows with `PARSE_WORKERS`.
- Error messages from a worker are mapped to reason codes in the main thread and never carry document text.
- Worker isolation limits damage from a hostile file but is not a sandbox. Parser hardening (zip bombs, page and cell caps, sandboxing) is Stage 19.
