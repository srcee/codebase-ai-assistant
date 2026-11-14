# Stage 18 — Quality, Evaluation, and Documentation (M6, part 2)

**Goal:** Close quality gaps, measure answer quality across code and documents, and make the project reproducible on a new machine.

**Status:** Not started

**Prerequisites:** Stages 1-17.

## Tasks

1. Robustness: large repositories and document folders, limits behavior, restart recovery, cancellation, Windows path edge cases, sync of large collections, worker pool under load.
2. Final evaluation report: Recall@k, MRR, citation validity, groundedness, abstention quality, latency, indexing coverage, separately for code, documents, tables, schemas, and images, and for mixed-source projects; compare against Stage 7, 9, and 10 baselines.
3. Documentation: setup guide (Node, Docker, Ollama, embedding, chat, and vision models), environment variable reference, migration commands, failure modes and troubleshooting, sync and re-index behavior, data retention and deletion, architecture overview.

## Definition of Done

- All tests (unit, integration, e2e) pass from a clean clone.
- Setup guide validated on a fresh checkout.
- Evaluation report committed.
- Remaining items go to the roadmap (hosted AI, watchers, worker/queue, more languages, remote connectors).

## Related items

- [Index job time limit](local/improvements/004-index-job-time-limit.md)
- [OpenAPI](local/improvements/007-openapi.md)
