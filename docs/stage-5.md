# Stage 5 — Privacy Policy and Local Inference Adapters

**Goal:** Central egress policy and local-only embedding/LLM adapters, built before any code is embedded.

**Status:** Done (CAA-6, PR #5)

**Prerequisites:** Stage 1 (config). Can run in parallel with Stage 4.

## Tasks

1. Install Ollama locally (not currently installed). Pull one embedding model and one chat model. Record names, vector dimensions, and context sizes in `.env.example` and `docs/decisions/0005-models-and-egress-policy.md`. Confirm `EMBEDDING_DIMENSIONS` matches the migration (Stage 2).
2. Create the `privacy` feature module in `apps/api/src/app/modules/privacy`:
   - Validates `INFERENCE_BASE_URL`: allow only loopback (`localhost`, `127.0.0.1`, `::1`) by default; reject everything else, including DNS names resolving to non-loopback and URL tricks (userinfo, redirects).
   - Single provider registry; only the `local` provider exists. No remote provider code.
   - Startup fails closed on invalid privacy configuration.
   - Wrap outbound HTTP so the adapters can only use the policy-checked client; redirects disabled.
3. Create the `inference` feature module in `apps/api/src/app/modules/inference`: ports (`EMBEDDING_PORT`, `CHAT_PORT`, `RUNTIME_HEALTH_PORT`), inference errors, and one plug-in adapter per runtime in `adapters/<runtime>/` (Ollama only), chosen by `INFERENCE_RUNTIME`. Adapters use only the policy-checked client and translate the wire format.
4. Create the `embeddings` feature module in `apps/api/src/app/modules/embeddings`: runtime-agnostic `EmbeddingsService` with batching, bounded retries, and dimension validation against config; the Ollama adapter refuses to truncate.
5. Create the `generation` feature module in `apps/api/src/app/modules/generation` (entry point only): `GenerationService` with completion and streaming over the chat port, clear `InferenceUnavailable` error; no fallback.
6. Extend `/health` with inference reachability and model presence.
7. Disable telemetry in dependencies where applicable and document any network access.

## Tests

- Remote/non-loopback/malformed URLs rejected; startup fails.
- Dimension mismatch raises an error.
- Model unavailable returns a clear error and no other provider is attempted (spy confirms).
- Adapters tested against a fake local HTTP server; optional smoke test against real Ollama (skipped when absent).
- Logs contain no input text (canary assertion).

## Definition of Done

- A local embedding and a local chat completion succeed through the adapters.
- Policy tests pass; remote endpoints cannot be configured.
