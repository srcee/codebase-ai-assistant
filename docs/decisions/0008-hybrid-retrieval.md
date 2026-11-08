# 0008: Hybrid retrieval

Status: accepted

## Context

Stage 7 finds the chunks that answer a question. Questions mix exact identifiers and error strings with paraphrases, several repositories can be indexed at once, and the browser must never choose which repositories are searched. Source text, chunks, and queries stay local and out of logs.

## Decision

- **Two searches, one fusion.** A pgvector cosine search and a Postgres full-text search each return up to `RETRIEVAL_CANDIDATE_LIMIT` (40) chunks. Reciprocal Rank Fusion merges them with `1 / (RETRIEVAL_RRF_K + rank)`, k = 60. Ties go to the better single rank, then the chunk id, so results are deterministic.
- **Context budget.** The fused list is cut at `RETRIEVAL_MAX_CHUNKS` (8) and `RETRIEVAL_MAX_CONTEXT_CHARS` (12000). A chunk whose lines overlap a better chunk of the same file is dropped. A chunk that does not fit the remaining characters is skipped, and smaller ones after it are still considered.
- **Scope is enforced in SQL.** Both searches filter `repository_id` with the ids from the request. An empty list returns nothing without running a query, and unknown ids match nothing.
- **Vector search** compares only chunks with the current embedding identity. Inside a transaction it sets `hnsw.iterative_scan = relaxed_order` and `hnsw.ef_search` with `set_config`, so the repository filter cannot leave the HNSW scan with too few rows, and it sorts the rows again afterwards. If the embedding model is unavailable the search fails; there is no lexical-only fallback.
- **Full-text search uses `search_terms`.** The `simple` configuration keeps dotted and path-like text such as `this.userService.findOne` or `src/a/b.ts` as one lexeme, and it does not split camelCase, so `findOne` would never match. `searchTermsFor` therefore computes the distinct lower-case words of the symbol name and content plus the parts of camelCase words (at most 2000), and the app stores them in `code_chunks.search_terms`. `search_vector` is generated from the symbol name (weight A), the content (D), and the terms (C). The query is built by the same function, so index and query always agree, and the retrieval module imports it from the ingestion utilities instead of keeping a second copy. Changing the scheme needs a `CHUNKING_VERSION` bump (now 3) and a re-index.
- **Query construction.** Terms are lower-case alphanumerics only, minus a short stopword list and capped at 64, joined with `|` and passed to `to_tsquery` as a bound parameter, so query text cannot add operators or SQL. A chunk containing the whole query as an adjacent phrase (`phraseto_tsquery` on the original text) gets +1, which ranks exact error strings first. Ranking uses `ts_rank_cd` with length normalization.
- **Embedding prefixes.** `EMBEDDING_QUERY_PREFIX` and `EMBEDDING_DOCUMENT_PREFIX` (empty by default) are added by `embedQuery` and `embedDocuments`. A non-empty document prefix adds a short hash to the embedding identity, so changing it re-embeds everything; the query prefix does not.
- **Debug endpoint.** `POST /search` takes `{ query, repositoryIds }` (query up to 2000 characters, 1 to 20 unique UUIDs). It returns `404` unless `RETRIEVAL_DEBUG_ENDPOINT=true`, because the response holds source text. The loopback and token guards run first, so an unauthenticated caller still gets `401`.
- **Database limits** (improvement 003). `DATABASE_POOL_MAX` (10), `DATABASE_IDLE_TIMEOUT_MS` (10000), and `DATABASE_STATEMENT_TIMEOUT_MS` (30000) apply to the pool, `INDEXING_EMBED_CONCURRENCY` must stay below the pool size, and a statement cancelled by the timeout answers `503` without the SQL.
- **Evaluation.** `libs/server/testing/eval` holds a committed synthetic corpus (30 files, no secrets) and a versioned question set with an expected file and line range per question. A result hits when it is in the same file and its lines overlap an expected range. The opt-in `retrieval.eval.spec.ts` indexes the corpus with the real local model, scores vector, lexical, and hybrid search (Recall@5, Recall@10, MRR@10, latency, indexing coverage), and writes a report next to the corpus. The result window is fixed at 10 chunks so Recall@10 is measurable.

## Consequences

- Baseline (`reports/baseline.md`, 102 chunks): hybrid Recall@10 97.4% and MRR@10 0.850, against 94.7% / 0.829 for vector and 93.4% / 0.820 for lexical. The corpus is small, so these numbers are optimistic and are meant for comparing runs.
- Fused scores are rank-based and only comparable within one response, so Stage 8 cannot use them as an absolute threshold for abstaining.
- Retrieval depends on a function in the ingestion utilities. If more modules need it, it moves to a shared place.
- `search_terms` stores each chunk's words a second time, which costs disk and index size.
- The HNSW parameters (`m`, `ef_construction`, `ef_search`) are pgvector defaults plus `RETRIEVAL_HNSW_EF_SEARCH`. Whether the index is worth its cost at this scale, the effect of the prefixes, chunk size and overlap, the candidate limit, and RRF k are still to be measured with the harness and recorded here.
