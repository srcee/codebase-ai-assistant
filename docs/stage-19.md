# Stage 19 — Security Hardening, Privacy Gate, and Release (M5 + M6, part 3)

**Goal:** Harden the product against hostile input and misconfiguration, prove the privacy invariant, and release V1.

**Status:** Not started

**Prerequisites:** Stages 1-18.

The privacy invariant is not deferred: local-only inference, the loopback egress policy, no content in logs, server-side scope, and basic size limits apply from Stage 8 on. This stage adds the hardening that a single-user local tool can live without while features are built.

## Tasks

1. Privacy regression suite (run in CI/local):
   - Canary secret in a fixture repo and a fixture document collection: assert absent from logs, DB (if excluded), prompts, and outbound requests.
   - Hosted-provider client replaced with a spy: never invoked.
   - Remote inference URLs rejected; local model failure (embedding, chat, vision) triggers no fallback.
   - Outbound network audit during index, sync, upload, and chat flows (a test agent that fails on any non-loopback connection), including parser workers.
2. Document parser hardening:
   - Zip-based formats (DOCX, XLSX, zip exports): uncompressed size, entry count, and compression ratio caps (zip bombs); reject path traversal in entry names.
   - PDF: page, object, and stream caps; XLSX: cell and shared-string caps; HTML: depth cap; images: pixel-count cap before decode.
   - Review worker isolation (decision 0011): consider a child process with reduced privileges for the parsers with the worst CVE history.
   - Optional content checks for uploads (type confirmed by magic bytes, malware scanning if the tool is ever shared).
3. Dependency and telemetry review: audit packages (including the parser and image libraries) for phone-home behavior; disable telemetry (Nx, Drizzle tooling, Vite, etc.); run `npm audit`; document remaining network access (package install, image pulls, model pulls only).
4. Log review: confirm no source, document text, image descriptions, embeddings, full prompts, or raw payloads are logged.
5. Security review against OWASP Top 10 for the local API: DTO validation, SQL parameterization, upload handling, loopback binding, CORS restricted to the local web origin, security headers and CSP, rate limiting if exposed beyond loopback.
6. Data at rest: `DATA_DIR` blobs, database volume, and conversation retention; documented deletion and backup behavior.
7. Release: tag `v0.1.0`, changelog, clean-clone smoke test following only the README.

## Tests

- Zip bomb, deeply nested HTML, huge-dimension image, and over-cap PDF fixtures fail their file with a reason and leave the API responsive.
- Upload with a mismatched extension and magic bytes is rejected.
- Outbound audit passes for every flow.

## Definition of Done

- Privacy suite, hardening fixtures, and the OWASP review pass or have documented, accepted residual risks.
- Privacy audit committed; no privacy invariant regressed.
- Release tagged after a clean-clone smoke test.

## Related items

- [Security headers and CSP](local/security/004-security-headers-csp.md)
- [Ollama exposure](local/security/007-ollama-exposure.md)
- [Data at rest and deletion](local/security/008-data-at-rest-and-deletion.md)
- [Dependency scanning](local/improvements/006-dependency-scanning.md)
