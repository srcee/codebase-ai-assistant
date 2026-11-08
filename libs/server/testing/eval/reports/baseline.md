# Retrieval evaluation: baseline

Generated 2026-11-08T12:18:59.146Z from question set v1 (38 questions).

## Results

| Mode    | Recall@5 | Recall@10 | MRR@10 | p50   | p95   |
| ------- | -------- | --------- | ------ | ----- | ----- |
| vector  | 90.8%    | 94.7%     | 0.829  | 29 ms | 52 ms |
| lexical | 92.1%    | 93.4%     | 0.820  | 4 ms  | 7 ms  |
| hybrid  | 96.1%    | 97.4%     | 0.850  | 29 ms | 33 ms |

## Recall@10 by category

| Category     | Questions | vector | lexical | hybrid |
| ------------ | --------- | ------ | ------- | ------ |
| identifier   | 8         | 100.0% | 100.0%  | 100.0% |
| snake-case   | 6         | 83.3%  | 100.0%  | 100.0% |
| error-string | 7         | 100.0% | 100.0%  | 100.0% |
| paraphrase   | 13        | 96.2%  | 88.5%   | 96.2%  |
| cross-file   | 4         | 87.5%  | 75.0%   | 87.5%  |

## Questions with a missed location in the top 10

- vector: snake-case-02, paraphrase-02, cross-file-01
- lexical: paraphrase-02, paraphrase-07, cross-file-01, cross-file-02
- hybrid: paraphrase-02, cross-file-01

## Indexing

- Files: 30 indexed of 30 discovered (coverage 100.0%), 0 skipped, 0 failed
- Chunks: 102
- Duration: 7177 ms

## Configuration

- Embedding identity: ollama/nomic-embed-text
- Query prefix: "", document prefix: ""
- Chunks: up to 2000 characters, 200 overlap, chunking version 3
- Candidates per search: 40, RRF k: 60, HNSW ef_search: 100
