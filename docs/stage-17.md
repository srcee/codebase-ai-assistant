# Stage 17 — Web UI (M6, part 1)

**Goal:** Usable React interface for projects, code and document sources, sync and indexing status, chat with scope selection, and source inspection.

**Status:** Not started (Stage 9 added a minimal chat: scope picker, streaming answers with citations, abstention display, conversation list; it is the starting point here)

**Prerequisites:** Stages 8-16 (API complete).

## Tasks

1. API client in the web app using types from `libs/shared/contracts`; centralized error handling.
2. Projects view: create, rename, delete, and choose the sources of a project; "Pull latest" for the whole project.
3. Sources view: code repositories and document collections with status. Register a repository or a folder collection (path entered against the allowlisted roots; surface server validation errors), create an upload collection and upload files (drag and drop, progress, size errors), remove with confirmation, "Index" / "Sync" button, and a "changes available" badge from the changes endpoint.
4. Index progress: poll job status; show counts, skipped files with reasons, failures, and retry.
5. Chat view:
   - Project or source scope selector with the active scope always visible.
   - Message list, loading and streaming (if implemented) states.
   - Distinct display for abstention vs. normal answers.
   - Conversation list, delete conversation control.
6. Citations: clickable chips opening a source inspector panel that renders by locator: code with line numbers, document sections with heading path and page, table rows with headers, schema entities, and image previews (excerpt and preview fetched from the index via scoped API endpoints, e.g. `GET /chunks/:id`, `GET /documents/:id/preview`).
7. Actionable dependency errors: database down, Ollama unreachable, embedding, chat, or vision model missing — driven by `/health`.
8. Accessibility basics and keyboard support; no external CDNs, fonts, analytics, or telemetry (fully offline-capable).

## Tests

- Component tests for citation rendering per locator kind, abstention state, scope selector, and upload errors.
- Basic e2e (Playwright optional) over fixtures: create a project with a repo and a document collection, index, ask, open citations of both kinds.
- Check that the built bundle makes no requests to external hosts.

## Definition of Done

- The full flow works in a browser against local services.
- No external network calls from the UI.

## Related items

- [Safe rendering of model output](local/security/005-safe-rendering-of-model-output.md)
- [Required e2e suite](local/improvements/009-required-e2e.md)
- Security headers and CSP are in Stage 19.
