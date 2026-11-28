# 0010: Document storage and sync

Status: accepted (folder collections in PR #17, uploads in PR #18)

## Context

Documents change: specs get edited, permission matrices get new rows, design exports are refreshed. The index must follow those changes with one action ("Pull latest"), re-index only what changed, and drop what was removed. Documents arrive from local folders or as uploads. Re-indexing also happens without any document change, when the embedding model, chunking version, parser version, or vision model changes.

## Decision

- **The content hash is the source of truth**, as for code (decision 0006). A file is unchanged only if its SHA-256 and the index identity match. The identity is the embedding identity, the chunking version of its format, and for images the vision identity (decision 0012). Modification times are not trusted, because copies and exports reset them.
- **Folder collections are mirrored, not copied.** The folder (inside `ALLOWED_DOCUMENT_ROOTS`, same path policy as code) is the original. "Pull latest" starts a sync job: walk, hash, index new and changed files, delete rows for files that are gone. Exports from Confluence, Notion, or Figma are refreshed by exporting into the same folder again.
- **Uploads go to a local content-addressed store.** An uploaded file is streamed to a temporary file under `DATA_DIR` while it is hashed, then moved to `DATA_DIR/blobs/sha256/<first two hex>/<hash>`. A `documents` row maps the logical path inside the collection (for example `specs/roles.xlsx`, normalized, no `..`) to the blob hash. Uploading the same path again is a no-op when the hash matches, and otherwise re-indexes only that document. Unreferenced blobs are deleted after the transaction that removed their last reference.
- **Originals are kept for uploads** so that a model or chunking change can re-index without asking for the files again, and so the source inspector can show the original. They never leave the machine, and they are removed when their document or collection is deleted.
- **One job type.** Sync reuses the index job model: one active job per source, counters, per-file skip and failure reasons, cancellation, restart recovery. For upload collections, "Pull latest" re-checks identities only, because there is no external original to compare.
- **Check for changes.** `GET /document-collections/:id/changes` walks and hashes without parsing or embedding and returns counts of new, changed, and removed files, so the UI can show that a sync is needed.
- **Project-level sync** starts one job per source in the project. Sources that already have an active job are reported, not queued twice.
- **Basic limits now.** `DOCUMENT_MAX_BYTES` caps one file (upload or folder) and `UPLOAD_MAX_FILES` caps one request. Oversized files are skipped with a reason. Further hardening is in Stage 19.
- **Folder sync details** (PR #17). Folders are walked with the exclusion rules of code ingestion (secret filenames, built-in and custom exclusions, `.gitignore`). A file skipped for its content after hashing (`binary`, `invalid-encoding`, `secret-content`) keeps its hash and index identity, so it is not parsed again while unchanged; a failed file is tried again on every sync. `GET /changes` counts as `new` the indexable files without a row, as `changed` those the indexer would not treat as unchanged, and as `removed` the indexed files that are gone or now excluded. `POST /projects/:id/sync` answers `{ started, alreadyActive }`.
- **Upload details** (PR #18, migration `0004_upload_documents`).
  - Upload collections have no `canonical_path`; a CHECK requires a path for every other source and none for uploads. Their documents are listed from `documents` rows, and a blob is read only when its document is parsed, after its hash is checked again.
  - `POST /document-collections/:id/documents` takes `multipart/form-data` with a `path` field before each `file` part, parsed with `busboy` (a pinned direct dependency, already used by Nest's multer) so files stream to disk instead of memory. The logical path is unique per collection ignoring case, because Windows paths ignore case. The format comes from the extension, never the client's content type.
  - A successful upload or document delete changes the rows, then starts a sync with the same job model. Both are refused with `409` while the collection has an active job, so a running sync never sees half-changed rows; the source row lock orders them against job creation.
  - Unreferenced blobs are removed by a sweep, not in the delete transaction. Uploads take a shared Postgres advisory lock while they move a blob in and write its row, and the sweep takes it exclusively, so a blob is never deleted while a row starts to reference it. The sweep runs after a document or upload collection is deleted and after content is replaced; it is idempotent, and a failed sweep only leaves a blob for the next one. It does not run at startup, because a test or eval run with another database must never delete the originals of the real one. Startup only removes temp files older than a day.

## Consequences

- Sync reads and hashes every file. That is cheap next to parsing and embedding, and avoids mtime mistakes. A stat-based shortcut can be added if large folders make it slow.
- `DATA_DIR` holds private documents. It is local, gitignored, and covered by the data-at-rest item in Stage 19.
- No filesystem watchers. Sync is explicit, which keeps it predictable and cheap when idle.
- Renamed files are new paths. Their chunks reuse vectors by `chunk_hash` within the source, as for code.
