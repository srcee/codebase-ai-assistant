# 0008: Hybrid retrieval

Status: accepted

## Context

Stage 7 finds the chunks that answer a question. Questions mix exact identifiers and error strings with paraphrases, several repositories can be indexed at once, and the browser must never choose which repositories are searched. Source text, chunks, and queries stay local and out of logs.

## Decision

- **Two searches, one fusion.** A pgvector cosine search and a Postgres full-text search each return up to `RETRIEVAL_CANDIDATE_LIMIT` (40) chunks. Reciprocal Rank Fusion merges them with `1 / (RETRIEVAL_RRF_K + rank)`, k = 60. Ties go to the better single rank, then the chunk id. Chunk ids are random for each index run, so the order of equal scores can differ between runs.
- **Context budget.** The fused list is cut at `RETRIEVAL_MAX_CHUNKS` (8) and `RETRIEVAL_MAX_CONTEXT_CHARS` (12000). A chunk whose lines overlap a better chunk of the same file is dropped. A chunk that does not fit the remaining characters is skipped, and smaller ones after it are still considered.
- **Scope is enforced in SQL.** Both searches filter `repository_id` with the ids from the request. An empty list returns nothing without running a query, and unknown ids match nothing.
- **Vector search** compares only chunks with the current embedding identity. Inside a transaction it sets `hnsw.iterative_scan = relaxed_order` and `hnsw.ef_search` with `set_config`, so the repository filter cannot leave the HNSW scan with too few rows, and it sorts the rows again afterwards. If the embedding model is unavailable the search fails; there is no lexical-only fallback.
- **Full-text search uses `search_terms`.** The `simple` configuration keeps dotted and path-like text such as `this.userService.findOne` or `src/a/b.ts` as one lexeme, and it does not split camelCase, so `findOne` would never match. `searchTermsFor` therefore computes the distinct lower-case words of the symbol name and content plus the parts of camelCase words (at most 2000), and the app stores them in `code_chunks.search_terms`. `search_vector` is generated from the symbol name (weight A), the content (D), and the terms (C). The query is built by the same function, so index and query always agree, and the retrieval module imports it from the ingestion utilities instead of keeping a second copy. Changing the scheme needs a `CHUNKING_VERSION` bump (now 3) and a re-index.
- **Query construction.** Terms are lower-case alphanumerics only, minus a short stopword list and capped at 64, joined with `|` and passed to `to_tsquery` as a bound parameter, so query text cannot add operators or SQL. A chunk containing the whole query as an adjacent phrase (`phraseto_tsquery` on the original text) gets +1, which ranks exact error strings first. Ranking uses `ts_rank_cd` with length normalization.
- **Embedding prefixes.** `EMBEDDING_QUERY_PREFIX` and `EMBEDDING_DOCUMENT_PREFIX` are added by `embedQuery` and `embedDocuments`. The code defaults are empty, and `.env.example` sets the nomic values (see Tuning). A non-empty document prefix adds a short hash to the embedding identity, so changing it re-embeds everything; the query prefix does not.
- **Debug endpoint.** `POST /search` takes `{ query, repositoryIds }` (query up to 2000 characters, 1 to 20 unique UUIDs). It returns `404` unless `RETRIEVAL_DEBUG_ENDPOINT=true`, because the response holds source text. The loopback and token guards run first, so an unauthenticated caller still gets `401`.
- **Database limits** (improvement 003). `DATABASE_POOL_MAX` (10), `DATABASE_IDLE_TIMEOUT_MS` (10000), and `DATABASE_STATEMENT_TIMEOUT_MS` (30000) apply to the pool, `INDEXING_EMBED_CONCURRENCY` must stay below the pool size, and a statement cancelled by the timeout answers `503` without the SQL.
- **Evaluation.** `libs/server/testing/eval` holds a committed synthetic corpus (30 files, no secrets) and a versioned question set with an expected file and line range per question. A result hits when it is in the same file and its lines overlap an expected range. The opt-in `retrieval.eval.spec.ts` indexes the corpus with the real local model, scores vector, lexical, and hybrid search (Recall@5, Recall@10, MRR@10, latency, indexing coverage), and writes a report next to the corpus. The result window is fixed at 10 chunks so Recall@10 is measurable.

## Tuning

Each setting was run once on the 38-question set (102 chunks), changing one thing against the baseline. The same settings score about 0.03 MRR apart between runs, because chunk ids break score ties and are random per index run, so smaller differences are noise. One expected location is 1.3 points of Recall@10.

| Setting                                                             | Hybrid Recall@10 | Hybrid MRR@10              | Note                                                                                                  |
| ------------------------------------------------------------------- | ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Baseline: no prefixes, 2000-character chunks, 40 candidates, k = 60 | 97.4%            | 0.850                      |                                                                                                       |
| nomic query and document prefixes                                   | 97.4%            | 0.912 and 0.886 (two runs) | Vector alone: Recall@10 94.7% to 97.4%, MRR 0.829 to 0.860; snake_case vector Recall@10 83.3% to 100% |
| 20 or 80 candidates per search                                      | 97.4%            | 0.851, 0.863               | No effect on recall                                                                                   |
| RRF k = 10 or 100                                                   | 97.4%            | 0.850                      | No effect                                                                                             |
| 1000-character chunks                                               | 98.7%            | 0.879                      | One more location found                                                                               |
| 600-character chunks                                                | 98.7%            | 0.897                      | Recall@5 falls from 96.1% to 94.7%                                                                    |
| Prefixes and 1000-character chunks                                  | 98.7%            | 0.899                      | Not better than prefixes alone                                                                        |

Adopted: the prefixes, set in `.env.example`. The model documents them and they are the only change that clearly beats the noise. The code defaults stay empty, because an empty environment value falls back to the default and a model-specific default would apply to other models. Kept: 2000-character chunks with 200 overlap, 40 candidates, and k = 60. The chunk-size gain is within the noise on a corpus whose symbols are mostly small. The final report (`reports/final.md`) uses the prefixes: hybrid Recall@5 96.1%, Recall@10 97.4%, MRR@10 0.886, against 96.1%, 97.4%, and 0.850 for the baseline, and hybrid is at least as good as vector or lexical search alone on Recall@5 and MRR.

## HNSW

`hnsw.benchmark.spec.ts` (opt-in, `RUN_HNSW_BENCHMARK=true`) inserts synthetic 768-dimension vectors in 200 clusters across 4 repositories and runs 100 queries, each filtered to one repository and asking for the top 10. Without a vector index the query is exact and gives the ground truth for recall. With 20,000 chunks and the default parameters (`m` 16, `ef_construction` 64):

| Path                                          | Recall@10 | p50                      | p95                      |
| --------------------------------------------- | --------- | ------------------------ | ------------------------ |
| No vector index (exact scan)                  | 100%      | 32.9 ms                  | 34.4 ms                  |
| HNSW forced, `ef_search` 40 / 100 / 200 / 400 | 100%      | 4.6 / 4.8 / 5.9 / 7.5 ms | 5.3 / 5.6 / 6.7 / 8.5 ms |

- The index takes 8.2 s to build and 78 MB of disk for 20,000 chunks. `m` 32 with `ef_construction` 128 built 4.6 times slower (38.1 s), was the same size, and gained no recall.
- Recall was 100% at every `ef_search` from 40 up, so 100 stays as the default: it keeps a margin on real embeddings, which cluster less cleanly, at about the same latency.
- The production query with the index follows the planner. For the first runs after the index was built the planner chose the exact scan (32.3 ms), and later runs used the index (6.2 to 9.1 ms) with only `ef_search` changed. At this size the choice is close, and in both cases the results are exact or near-exact, so it affects speed, not correctness.
- Decision: keep the Stage 2 index with the pgvector defaults and make no migration. It is about six times faster than the exact scan at 20,000 chunks, and the exact scan grows with the number of chunks in the selected repositories. The cost is disk and build time. A repository too small to need it still works, because the planner falls back to the exact scan.
- The data is synthetic and clustered, and the run is a single machine, so absolute recall and latency will differ on real embeddings. Re-run the benchmark before changing `m`, `ef_construction`, or `ef_search`.

## Consequences

- Baseline (`reports/baseline.md`, 102 chunks): hybrid Recall@10 97.4% and MRR@10 0.850, against 94.7% / 0.829 for vector and 93.4% / 0.820 for lexical. The corpus is small, so these numbers are optimistic and are meant for comparing runs.
- Fused scores are rank-based and only comparable within one response, so Stage 9 (chat) cannot use them as an absolute threshold for abstaining.
- Retrieval depends on a function in the ingestion utilities. If more modules need it, it moves to a shared place.
- `search_terms` stores each chunk's words a second time, which costs disk and index size.
- The evaluation corpus is small, so recall is near its ceiling and most settings cannot be told apart. A larger or harder corpus is the first thing to add before tuning chunk size, candidates, or k again.
