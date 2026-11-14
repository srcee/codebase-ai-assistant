# Stage 7 — Hybrid Retrieval and Evaluation (M3)

**Goal:** Reliable retrieval with repository scoping enforced in SQL, measured by an evaluation set.

**Status:** Done (decision 0008; baseline and final reports in `libs/server/testing/eval/reports`)

**Prerequisites:** Stage 6.

## Tasks

1. Create the `retrieval` feature module in `apps/api/src/app/modules/retrieval`:
   - Vector search (pgvector cosine) and full-text search (`tsvector`, with identifier-friendly tokenization for camelCase/snake_case, and exact-match handling for error strings).
   - Both queries take a mandatory `repositoryIds` filter applied in SQL; empty or unknown IDs return nothing, never everything.
   - Merge with Reciprocal Rank Fusion (simple, no tuning needed); optional light re-rank later.
   - Enforce a context budget (max chunks and characters/tokens); dedupe overlapping chunks from the same file.
   - Return provenance: repository ID/name, relative path, start/end line, symbol, score, source (vector/lexical).
2. Add the vector index (HNSW) if benchmarks justify it; record parameters.
3. Internal-only debug endpoint or script `POST /search` (loopback only, may be removed later) to inspect retrieval.
4. Evaluation harness in `libs/testing` (or `tools/eval`):
   - Versioned set of 20-50 questions over fixture/approved repositories with expected files/line ranges.
   - Metrics: Recall@k, MRR (or nDCG), latency, indexing coverage.
   - Output a report file; fixtures free of real secrets.
5. Tune chunk size, overlap, `k`, and fusion using the harness; record results in `docs/decisions/0003-retrieval-tuning.md`.

## Tests

- Repository filter isolation: chunks from repo B never returned for a query scoped to repo A (including crafted queries).
- Exact identifier query is found by lexical search; paraphrased query is found by vector search.
- Context budget respected; results carry valid provenance (file and line range exist).
- Query text is parameterized (SQL injection attempt returns safely).

## Definition of Done

- Evaluation report committed with baseline metrics.
- Isolation tests pass.

## Related items

- [Database pool and statement timeout](local/improvements/003-database-pool-and-statement-timeout.md)
