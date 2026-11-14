# Stage 3 — Repository Registration and Path Policy (M1)

**Goal:** Safely register, list, inspect, and remove local repositories.

**Status:** Done (CAA-3, PR #2)

**Prerequisites:** Stage 2.

## Tasks

1. Create a `codebases` feature module in `apps/api/src/app/modules/codebases` with a path-policy service:
   - Resolve with `realpath`, canonicalize, normalize Windows drive-letter casing and separators.
   - Must be inside one of `ALLOWED_REPO_ROOTS`; reject otherwise.
   - Must be an existing directory; check for a `.git` directory (configurable).
   - Reject UNC/device paths and paths whose symlinks resolve outside the root.
2. Repository service + controller:
   - `POST /codebases` (`{ path, name? }`), `GET /codebases`, `GET /codebases/:id`, `DELETE /codebases/:id`.
   - Duplicate canonical path returns a conflict.
   - Responses expose a display name and relative-to-root path, not raw absolute paths.
   - Delete cascades to files, chunks, and jobs.
3. Shared contracts for request/response DTOs in `libs/shared/contracts`.
4. Server-side DTO validation; unknown fields rejected.
5. Confirm API is bound to loopback only; add a startup warning or refusal if a non-loopback host is configured without explicit opt-in.
6. Minimal web UI is deferred to Stage 17.

## Tests

- Unit: traversal (`..`), symlink/junction escape, path outside allowed roots, non-directory, nonexistent path, case/separator variants on Windows, UNC paths.
- Integration (Supertest + DB): register/list/get/delete, duplicate registration, invalid body, deletion cascade.
- Responses never contain absolute paths.

## Definition of Done

- All path-policy tests pass, including symlink/junction cases on Windows.
- Endpoints documented in the README; failure modes listed.
