# Stage 10 — Document Collections, Sync, and Text Documents

**Goal:** Register document collections from a local folder or by upload, keep them in sync with one action, parse in a worker pool, and index Markdown and plain text with heading-aware chunks.

**Status:** Not started

**Prerequisites:** Stages 8 and 9.

**Decisions:** [0010 Document storage and sync](decisions/0010-document-storage-and-sync.md), [0011 Parsing worker pool](decisions/0011-parsing-worker-pool.md)

## Tasks

1. Configuration (zod, `.env.example`, README): `ALLOWED_DOCUMENT_ROOTS`, `DATA_DIR` (default `.local/data`, gitignored), `DOCUMENT_MAX_BYTES`, `UPLOAD_MAX_FILES`, `PARSE_WORKERS`, `PARSE_INLINE_MAX_BYTES`, `PARSE_TIMEOUT_MS`, `PARSE_WORKER_MAX_MEMORY_MB`.
2. Schema: `documents` (collection source id, logical path unique per collection, blob hash, size, media type, timestamps) for upload collections. Folder collections use `source_files` only.
3. Create the `document-collections` feature module:
   - `POST /document-collections` `{ name, origin: 'folder', path }` (path policy from decision 0002 against `ALLOWED_DOCUMENT_ROOTS`) or `{ name, origin: 'upload' }`.
   - `GET`, `GET /:id`, `DELETE /:id` (removes chunks, documents, and unreferenced blobs).
   - `POST /document-collections/:id/documents` (multipart, upload collections only): stream to a temp file under `DATA_DIR`, hash while streaming, move into the blob store, enforce `DOCUMENT_MAX_BYTES` and `UPLOAD_MAX_FILES`. The logical path comes from a field, is normalized, and rejects `..`, absolute paths, and drive letters.
   - `DELETE /document-collections/:id/documents/:documentId`.
   - `GET /document-collections/:id/changes`: new, changed, and removed counts without parsing.
   - `POST /document-collections/:id/sync` ("Pull latest") and `POST /projects/:id/sync` (one job per source; active jobs are reported, not duplicated).
4. Create the `document-ingestion` feature module:
   - Discovery for folder collections reusing the exclusion and secret-filename rules; format detection by extension and magic bytes.
   - `ParsingPoolService`: fixed worker pool, routing by format and size, timeout, memory limit, worker replacement, shutdown. Separate webpack entry for the worker.
   - A parser and chunker per format behind one interface returning chunks with `title`, `content_kind`, `locator`, and text. Per-format chunking versions in one constants file.
5. Indexing dispatches by source kind: code repositories use the existing pipeline, document collections use document ingestion. Unchanged detection, embedding reuse by `chunk_hash`, per-file transactions, stale removal, cancellation, and restart recovery are shared.
6. Markdown and TXT:
   - Split by headings; `title` is the heading path (`Roles > Reviewer > Permissions`), locator `section`.
   - Long sections split into windows with overlap; a window never crosses a heading.
   - Markdown tables are chunked as table rows with the header repeated (the table chunker is shared with Stage 11).
   - Front matter is kept as metadata text in the first chunk.
7. Search terms for prose: words from title and content, same function as code, so lexical search finds role and permission names exactly.
8. Evaluation: a synthetic product documentation corpus (roles, permissions, workflows, glossary) in `libs/server/testing/eval/documents` with a versioned question set and expected locators. Report Recall@k and MRR for document questions separately from code.
9. Bruno requests for collections, uploads, changes, and sync.

## Tests

- Upload: same path and hash is a no-op; same path with new content re-indexes only that document; delete removes chunks and the blob when unreferenced.
- Folder sync: new, changed, removed, and renamed files; second sync makes zero embedding calls.
- Logical path validation rejects traversal, absolute paths, and drive letters.
- Oversized file is skipped with a reason; too many files in one upload is rejected.
- Pool: binary format goes to a worker; small text runs inline; text above the threshold goes to a worker; a worker that hangs or throws fails that file only and is replaced.
- Markdown: heading paths, sections that do not cross headings, table rows with headers.
- Scope: a document collection outside the selected project is never searched.
- Canary secret in a document collection is excluded by filename rules and never logged.

## Definition of Done

- A folder of Markdown specs and an upload collection are indexed, synced, and searchable through `/search` and `/chat` with section citations.
- Document eval report committed.
