# Security 006: Chat streaming has no cancellation or limits

- **Status:** Open
- **Severity:** Medium (local resource exhaustion)
- **Area:** `apps/api` (chat, generation modules), `libs/server/config`
- **Target stage:** 8

## Problem

Stage 9 does not define what happens when an SSE client disconnects, nor limits on chat load. Without them:

- a closed tab leaves the model generating until it finishes;
- many tabs or a script can queue unbounded generations and saturate the local GPU/CPU;
- very long questions or histories inflate prompts and latency.

## Proposed fix

- Tie each chat request to an `AbortController`; abort on client `close` and pass the signal through `GenerationService` to `CHAT_PORT` and `EgressHttpClient`.
- Limit concurrent generations (config, small default such as 1–2); reject extra requests with 429 and a fixed message instead of queueing without bound.
- Max question length and max history turns in config, validated in the DTO.
- Server-side generation timeout (wall time) in addition to the inference request timeout.

## Tests

- Client disconnect aborts the fake chat port call.
- Requests over the concurrency limit get 429; the slot frees after completion and after abort.
- Overlong question is rejected with 400.

## Related

- [../improvements/001-logging.md](../improvements/001-logging.md)
