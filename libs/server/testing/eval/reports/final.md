# Retrieval evaluation: final

Generated 2026-11-08T13:04:32.735Z from question set v1 (38 questions).

## Results

| Mode    | Recall@5 | Recall@10 | MRR@10 | p50   | p95   |
| ------- | -------- | --------- | ------ | ----- | ----- |
| vector  | 90.8%    | 97.4%     | 0.860  | 24 ms | 42 ms |
| lexical | 92.1%    | 93.4%     | 0.820  | 3 ms  | 4 ms  |
| hybrid  | 96.1%    | 97.4%     | 0.886  | 25 ms | 30 ms |

## Recall@10 by category

| Category     | Questions | vector | lexical | hybrid |
| ------------ | --------- | ------ | ------- | ------ |
| identifier   | 8         | 100.0% | 100.0%  | 100.0% |
| snake-case   | 6         | 100.0% | 100.0%  | 100.0% |
| error-string | 7         | 100.0% | 100.0%  | 100.0% |
| paraphrase   | 13        | 96.2%  | 88.5%   | 96.2%  |
| cross-file   | 4         | 87.5%  | 75.0%   | 87.5%  |

## Questions with a missed location in the top 10

- vector: paraphrase-02, cross-file-01
- lexical: paraphrase-02, paraphrase-07, cross-file-01, cross-file-02
- hybrid: paraphrase-02, cross-file-01

## Indexing

- Files: 30 indexed of 30 discovered (coverage 100.0%), 0 skipped, 0 failed
- Chunks: 102
- Duration: 3562 ms

## Configuration

- Embedding identity: ollama/nomic-embed-text+22a337d2
- Query prefix: "search_query: ", document prefix: "search_document: "
- Chunks: up to 2000 characters, 200 overlap, chunking version 3
- Candidates per search: 40, RRF k: 60, HNSW ef_search: 100
