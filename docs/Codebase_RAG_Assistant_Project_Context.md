# Codebase RAG Assistant

## Project Context, Architecture, V1 Scope, Security, and Delivery Plan

**Status:** Working project specification for V1

## 1. Executive Summary

Build a local-first Codebase RAG Assistant that indexes multiple repositories on the developer’s machine and answers natural-language questions about their code. Answers should be grounded in retrieved source and include citations to repository, file path, and line ranges.

The defining requirement is privacy: in V1, repository source code and information derived from it must stay local. No hosted LLM APIs, hosted embedding APIs, cloud vector stores, or silent remote fallback. If local inference is unavailable, the feature should fail clearly rather than transmit code elsewhere.

The initial product is a developer tool, not an autonomous coding agent. It searches and explains code; it does not run shell commands, edit files, create commits, or open pull requests.

The same engine also serves product owners: document collections (specs, permission matrices, wiki exports, schemas, design exports, screenshots) are indexed next to code, grouped into projects, and answer questions such as "what permissions does the Reviewer role have?" with citations to section, page, table row, schema entity, or image. The privacy invariant covers documents exactly as it covers code (decisions 0009-0012).

## 2. Problem and Product Idea

Developers often work across several repositories and need to answer questions such as: Where is this behavior implemented? Which service calls this method? What happens when a request fails? Which files are relevant to a feature? The assistant should reduce the time spent manually navigating code while preserving evidence for every answer.

- Register one or more local repositories.
- Index supported source files and maintain metadata for each chunk.
- Ask questions in a chat interface and optionally scope a question to selected repositories.
- Retrieve relevant code using semantic and lexical search.
- Generate an answer with citations and abstain when evidence is insufficient.
- Re-index changed files without unnecessarily re-embedding unchanged content.
- Register document collections from a local folder or by upload, sync them with one action, and group code and documents into projects.

## 3. Repository Registration: What “Upload” Means

For V1, repositories are registered from local filesystem paths; they are not uploaded to a server or cloud. A user points the local application at a repository directory. The indexer reads eligible files and stores searchable chunks and metadata in the local PostgreSQL database. Embeddings and answer generation run through explicitly configured local inference.

Important browser limitation: a normal browser-based React app cannot freely browse arbitrary local folders. Start with an explicit, allowlisted local path configured for the local backend, or provide a local folder-picker/desktop companion later. Do not pretend that a web page can safely and portably access any path on the machine.

Registration flow: (1) user supplies a repository path through a trusted local setup/configuration flow; (2) backend resolves and canonicalizes the path; (3) backend verifies that the path is inside an allowed root and is a repository directory; (4) repository metadata is saved; (5) indexing runs and reports progress, skipped files, and errors; (6) user can inspect indexing status and re-index on demand.

- Canonicalize paths and validate them on the server, not just in the UI.
- Resolve symlinks and reject links that escape the permitted repository root; do not follow symlinks outside the root by default.
- Never accept arbitrary paths from untrusted network clients. Bind the local service to localhost or a trusted interface and apply an explicit allowed-root policy.
- Use .gitignore as useful guidance, but never as the only exclusion or security mechanism.
- Exclude .git, node_modules, vendor/build outputs, dist, coverage, caches, generated bundles, binaries, archives, and other low-value or oversized content.
- Always exclude common secret-bearing files and patterns such as .env files, private keys, credentials, certificates, and local secret stores. Add configurable exclusions and conservative secret scanning.
- Apply file-size and total-index limits; report skipped files and reasons. Do not log source contents or secrets.
  A future version may support cloning repositories or Git-provider integrations, but that is explicitly outside V1.

## 4. V1 Scope and Non-Goals

### Included in V1

- Local repository registration and safe path validation.
- File discovery, exclusion rules, language detection, chunking, content hashes, and index status.
- TypeScript/JavaScript support first, with syntax-aware chunking where practical.
- Local embeddings and a local LLM through a local inference runtime such as Ollama.
- PostgreSQL with pgvector for vector search, plus PostgreSQL full-text search for lexical matching.
- Hybrid retrieval, server-side repository filtering, grounded answers, citations, and a clear “not enough evidence” response.
- Chat history stored locally, with explicit privacy-conscious retention behavior.
- Tests for indexing correctness, retrieval quality, citation validity, and privacy boundaries.
- Document collections: Markdown, TXT, CSV, XLSX, PDF, HTML exports, DOCX, schemas (OpenAPI, JSON Schema, SQL DDL, GraphQL), images and Figma exports described by a local vision model. Parsing runs in a worker pool.
- Projects that group code repositories and document collections into one question scope.

### Explicitly out of scope

- Hosted AI APIs or cloud vector databases.
- LangChain, LangGraph, or another ready-made RAG orchestration framework.
- Autonomous agents, shell execution, arbitrary tool use, code edits, commits, or pull requests.
- Public SaaS deployment, multi-tenant hosting, GitHub/web search, or repository cloning.
- Remote connectors (Figma API, Confluence, Notion, Jira); their content comes in as local exports.
- Automatic fallback from local inference to a hosted provider.

## 5. Recommended Technology Stack

- Language: TypeScript throughout the application.
- Backend: NestJS as a modular monolith.
- Frontend: React + TypeScript, using Vite.
- Monorepo: Nx. Since Nx is already familiar, keep it; it is a common, capable choice for a TypeScript workspace. There is no compelling reason to switch solely for popularity.
- Database: PostgreSQL with pgvector extension.
- Inference: local runtime such as Ollama, accessed through application-owned ports with one adapter per runtime, so the runtime can be replaced without touching consumers.
- Parsing/chunking: start with deterministic text handling and TypeScript/JavaScript parsing; consider Tree-sitter for syntax-aware chunking where useful.
- ORM: run a small spike comparing Prisma and Drizzle for migrations, PostgreSQL full-text search, and pgvector operations. Use raw SQL for vector-specific queries if the ORM makes them awkward.
- Testing: Jest or Vitest for unit tests, Supertest for NestJS HTTP integration tests, and PostgreSQL+pgvector integration tests.
- Local services: Docker Compose for PostgreSQL+pgvector. The local model runtime may be installed separately.
  Avoid adding Redis, a separate worker service, or a distributed job system on day one. Start with a simple background indexing job model in the API process if the workload is modest. Introduce a worker/queue such as BullMQ only when real concurrency, durability, or throughput needs justify it.

## 6. Nx Monorepo Structure

Use Nx to coordinate applications, shared contracts, tests, linting, and builds. Keep the initial structure small. Feature modules live in the API app; add a library only for code shared across apps or reusable tooling, and do not create empty libraries for every possible future module.

```text
apps/
  api/                 # NestJS HTTP API and application orchestration
    src/app/
      filters/         # Cross-cutting filters (guards, interceptors, decorators get sibling folders)
      modules/
        codebases/     # Codebase registration and path policy
        projects/      # Projects grouping sources
        document-collections/ # Folder and upload collections, blob store, sync
        document-ingestion/   # Format parsers, chunkers, parsing worker pool
        ingestion/     # Discovery, exclusions, parsing, chunking, hashes
        embeddings/    # Batching, retries, dimension checks (runtime-agnostic)
        inference/     # Ports and runtime adapters (Ollama today)
        retrieval/     # Hybrid search and ranking
        generation/    # Prompt construction over the chat port (runtime-agnostic)
        privacy/       # Provider and egress policy
        chat/          # Chat orchestration and persistence
  web/                 # React + TypeScript + Vite
  worker/              # Optional later, if indexing needs a separate process

libs/
  shared/contracts/    # DTOs and types safe to share with the frontend
  server/config/       # Validated server configuration
  server/database/     # DB access and migrations (test factories in src/testing)
  server/testing/      # Test-only sandbox and config helpers
  shared/testing/      # Test-only factories for contracts, faker, canary secrets
```

Keep server-only code out of frontend-importable libraries. Shared contracts should contain safe DTOs and types, not database models, filesystem code, secrets, or server implementation. Enforce boundaries with Nx tags and lint rules as the workspace grows.

## 7. High-Level Architecture and Data Flow

Indexing flow: repository registration → canonical path/security checks → file discovery and exclusion → parsing and chunking → hashing and change detection → local embedding generation → persistence in PostgreSQL/pgvector.

Question flow: chat request with selected repository IDs → server-side authorization/scope validation → hybrid vector and full-text retrieval → ranking and context-size limits → local LLM prompt construction → answer with citations → citation validation and persistence.

The browser must never choose a provider or bypass repository scoping. The backend determines eligible repositories, retrieval filters, model configuration, and privacy rules. Every retrieved chunk must retain provenance so that a response can cite the original file and line range.

### Suggested NestJS modules

- Codebases: register/list/get/remove codebases and validate paths.
- Ingestion: discovery, exclusions, parsing, chunking, index jobs, and re-indexing.
- Embeddings: batching, retries, and vector dimension validation over the embedding port.
- Inference: ports (embedding, chat, runtime health) and one adapter per local runtime, selected by configuration.
- Retrieval: hybrid search, ranking, repository filters, and provenance.
- Generation: bounded prompts over the chat port, citation format, and abstention behavior.
- Privacy: central policy for inference providers and outbound network access.
- Chat: request orchestration, conversations, messages, and citations.
- Observability: timings, job status, and sanitized errors—never raw source or secrets.

## 8. Data Model (Initial Proposal)

From Stage 8 (decision 0009), `repositories` becomes `sources` (with `kind` and `origin`), `repository_files` becomes `source_files`, and `code_chunks` becomes `chunks` with `title`, `content_kind`, and a `locator`; `projects`, `project_sources`, and `documents` are added. The list below is the original code-only proposal.

- Repository: id, name, canonical_path, privacy_mode, status, last_indexed_commit (if available), created_at, updated_at.
- RepositoryFile: id, repository_id, relative_path, content_hash, language, size_bytes, status, last_indexed_at.
- CodeChunk: id, repository_id, file_id, chunk_hash, symbol_name, start_line, end_line, content, embedding, embedding_model, chunking_version.
- Conversation: id, created_at, updated_at, optional title.
- Message: id, conversation_id, role, content, created_at, model metadata where safe.
- MessageCitation: id, message_id, chunk_id or stable source reference, quoted range/metadata.
- IndexJob: id, repository_id, status, progress counters, timestamps, sanitized error summary.
  Add database constraints and indexes for repository ownership, unique relative paths, chunk hashes, vector search, and full-text search. Decide deliberately whether chat messages retain code excerpts; V1 should keep data local and offer clear conversation deletion behavior. On repository deletion, remove its files, chunks, embeddings, and related citations according to documented retention rules.

## 9. Chunking, Indexing, and Incremental Updates

Start with TypeScript and JavaScript. Prefer syntax-aware chunks based on functions, classes, methods, and other useful symbols when parsing succeeds; fall back to bounded text chunks for unsupported or malformed files. Store exact line ranges for citations.

- Use stable relative paths and content hashes to detect changes.
- Do not regenerate embeddings for unchanged chunks when the embedding model and chunking version are unchanged.
- Record the embedding model and chunking version; re-index when either changes.
- Handle oversized files and symbols with deterministic splitting and explicit limits.
- Preserve file path, language, symbol name, start/end lines, repository ID, and content hash for every chunk.
- Make indexing idempotent. Re-running indexing on an unchanged repository should not create duplicate chunks.
- Handle deleted/renamed files by removing stale index records.
- Expose progress and per-file skip/error reasons without revealing file contents.

## 10. Retrieval and Answer Quality

Use hybrid retrieval: PostgreSQL full-text search catches exact identifiers and error messages, while pgvector supports semantic similarity. Combine/rerank candidates, enforce repository filters in the backend query, and keep the final context within model limits.

- Scope every query to selected repositories in server-side SQL; never rely on frontend filtering.
- Return source metadata alongside each retrieved chunk.
- Ask the local LLM to answer only from provided evidence and to say when evidence is insufficient.
- Require citations for substantive code claims; validate that cited files and line ranges exist.
- Treat retrieval scores as signals, not proof. Evaluate answer groundedness and citation correctness.
- Treat source files as untrusted data: code/comments may contain prompt-injection text. Retrieved content must not grant tools or change system policy.

## 11. Security and Privacy Requirements

### Non-negotiable V1 privacy invariant

Repository source code, chunks, embeddings, prompts containing repository content, chat history containing code, and summaries derived from private source must not be sent to hosted AI or other remote services. V1 uses local inference for all repositories.

- No hosted LLM or embedding providers in V1; no automatic remote fallback.
- Configure the local inference endpoint explicitly and reject remote endpoints by default. If the local model is unavailable, return a clear error.
- Centralize provider policy in a privacy module so later provider support cannot bypass checks.
- Bind the API to localhost by default; do not expose the service to the public internet. Protect any non-local interface with deliberate authentication and network controls.
- Use canonical path checks, allowed roots, symlink restrictions, file limits, and safe exclusions.
- Do not execute repository code, shell commands, scripts, or tools in V1.
- Do not log source code, embeddings, secrets, complete prompts, or raw request payloads. Logs should contain identifiers, timings, status, and sanitized errors only.
- Review telemetry and dependency behavior; disable nonessential telemetry where possible and document any network access.
- Keep credentials out of source control. Validate environment configuration on startup and fail closed when privacy settings are invalid.
  Future hosted AI support is a separate, explicit scope change. It should require per-repository privacy classification, a central egress gateway, opt-in consent, and tests proving that private content and mixed-repository context cannot reach hosted providers. A browser-supplied “public” flag is not sufficient authorization.

## 12. API Sketch

- POST /codebases — register an allowed local path.
- GET /codebases — list registered codebases and index status.
- GET /codebases/:id — codebase details.
- POST /codebases/:id/index — start or request re-indexing.
- DELETE /codebases/:id — remove codebase and associated indexed data.
- POST /chat — ask a question with selected repository IDs and optional conversation ID.
- GET /conversations/:id — retrieve local conversation history.
- GET /health — health status for API, database, and local inference configuration.
  Validate all DTOs, reject unknown or malformed fields where practical, enforce repository scoping server-side, and keep provider selection out of public request payloads. Avoid exposing raw absolute paths unnecessarily in API responses.

## 13. Testing Strategy

### Unit tests

- Path canonicalization, traversal attempts, symlink escapes, allowed-root checks, and file-size limits.
- Exclusion rules, secret-like filenames, language detection, chunk boundaries, line ranges, hashes, and incremental change detection.
- Embedding dimension validation, batching behavior, retries/timeouts, retrieval filters, citation validation, and abstention.

### Integration tests

- PostgreSQL+pgvector migrations and query behavior.
- Repository indexing, idempotent re-indexing, changed/deleted files, and cleanup.
- NestJS DTO validation, error handling, and repository scoping.

### Privacy regression tests

- Use a synthetic canary secret in a test repository and assert it never appears in logs or outbound requests.
- Replace any hosted provider client with a spy/fake and assert it is never invoked in V1.
- Test that remote inference URLs are rejected by default and local model failure does not trigger fallback.
- Audit outbound network calls during representative indexing and chat tests.

### RAG evaluation

Build a small, versioned evaluation set of roughly 20–50 realistic questions over synthetic or approved test repositories. Track Recall@k, MRR or nDCG, citation validity, answer groundedness, abstention quality, latency, and indexing coverage. Keep evaluation fixtures free of real secrets.

## 14. Milestones and Definition of Done

- M0 — Workspace: Nx workspace, NestJS API, React/Vite frontend, lint/test/build commands, validated config, local dev documentation.
- M1 — Registration: register/list/remove repositories, allowed-root checks, symlink policy, safe local API binding.
- M2 — Indexing: file discovery, exclusions, parsing/chunking, hashes, PostgreSQL schema, job status, idempotent updates.
- M3 — Search: local embeddings, pgvector, PostgreSQL full-text search, repository filters, retrieval evaluation.
- M4 — Chat: local LLM generation, grounded answers, citations, insufficient-evidence behavior, conversation persistence.
- M5 — Privacy gate: remote-provider rejection, no-fallback tests, canary/log tests, outbound network review.
- M6 — UX and quality: indexing progress, source inspector, errors/retry states, evaluation report, setup guide.
- M7 — Documents: sources and projects, document sync, worker pool, text, tables, PDF, HTML, DOCX, schemas, images (Stages 8 and 10-16).
  The order is Stage 8 (sources and projects), 9 (chat), 10-16 (documents), 17 (web UI), 18 (quality), 19 (security hardening, privacy gate, release).
  A milestone is done only when its tests pass, configuration and failure modes are documented, and no privacy invariant has regressed.

## 15. UX Principles

- Show repository registration and indexing status clearly.
- Show what was indexed, skipped, or failed and why.
- Allow users to select repositories for a question and show the active scope.
- Make citations clickable and show file path, line range, and relevant excerpt.
- Distinguish evidence-backed statements from uncertainty; make abstention useful rather than vague.
- Explain local model/database setup and show actionable errors when dependencies are unavailable.
- Provide clear controls for deleting conversations and removing a repository from the index.

## 16. Future Roadmap (Not V1)

- Per-repository public/private classification and explicitly approved hosted inference for public-only contexts.
- A central egress gateway that checks all prompts, history, retrieved chunks, summaries, and tool outputs before any remote request.
- Git provider integration, repository cloning, web documentation search, and code-host links.
- Remote document connectors (Figma API, Confluence, Notion, Jira), each behind its own egress decision.
- Incremental filesystem watchers and a separate worker/queue when justified.
- Code graph/call graph retrieval and more language parsers.
- Agent integrations only after a separate security design; any execution or write capability requires explicit permissions, sandboxing, and auditability.

## 17. Implementation Rules for Copilot

- Implement one vertical slice at a time; do not scaffold the entire future architecture in one pass.
- Preserve the V1 local-only invariant. Do not add hosted AI APIs, remote vector stores, telemetry, or fallback providers.
- Do not add LangChain/LangGraph or another RAG orchestration framework; implement retrieval and orchestration in small, testable application modules.
- Do not execute repository code or add shell/edit/commit capabilities.
- Use explicit TypeScript types and validated configuration. Keep frontend-safe contracts separate from server-only code.
- Add tests for security boundaries and privacy behavior alongside features, not afterward.
- Never log raw source, secrets, full prompts, or complete request payloads.
- Document commands, environment variables, migrations, model setup, assumptions, and failure modes.
- When a requirement is ambiguous, prefer the option that keeps data local, minimizes privileges, and fails closed.
- Do not introduce dependencies or architecture layers without a concrete V1 need; explain trade-offs before broad changes.

## 18. Open Decisions to Resolve Early

- Choose the local inference runtime and select an embedding model plus a chat model; record model names and vector dimensions in configuration.
- Run a short Prisma-vs-Drizzle spike for migrations, full-text search, and pgvector support.
- Decide the initial repository registration UX: local backend config/allowlisted paths first, with a later folder-picker or desktop companion if needed.
- Set initial maximum file size, chunk size/overlap, context budget, and indexing concurrency using small benchmarks.
- Decide whether conversation history is retained by default and define deletion semantics.
- Define supported file extensions and exclusion rules for the first release.

## 19. Short Product Statement

A privacy-first, local Codebase RAG Assistant that indexes developer repositories on the same machine and answers questions with verifiable source citations. V1 prioritizes safe repository ingestion, hybrid search, local inference, reliable citations, incremental indexing, and tests that prove code does not leave the machine.
