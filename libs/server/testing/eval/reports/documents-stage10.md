# Retrieval evaluation: documents-stage10

Generated 2026-11-22T20:49:22.314Z from question set v1 (34 questions).

## Results

| Mode    | Recall@5 | Recall@10 | MRR@10 | p50   | p95   |
| ------- | -------- | --------- | ------ | ----- | ----- |
| vector  | 88.2%    | 97.1%     | 0.699  | 34 ms | 39 ms |
| lexical | 82.4%    | 97.1%     | 0.653  | 5 ms  | 6 ms  |
| hybrid  | 85.3%    | 97.1%     | 0.692  | 36 ms | 44 ms |

## Recall@10 by category

| Category        | Questions | vector | lexical | hybrid |
| --------------- | --------- | ------ | ------- | ------ |
| role-permission | 6         | 100.0% | 100.0%  | 100.0% |
| table-row       | 5         | 80.0%  | 100.0%  | 80.0%  |
| workflow        | 8         | 100.0% | 100.0%  | 100.0% |
| glossary        | 4         | 100.0% | 100.0%  | 100.0% |
| exact-term      | 5         | 100.0% | 100.0%  | 100.0% |
| paraphrase      | 6         | 100.0% | 83.3%   | 100.0% |

## Questions with a missed location in the top 10

- vector: table-row-02
- lexical: paraphrase-04
- hybrid: table-row-02

## Indexing

- Files: 12 indexed of 12 discovered (coverage 100.0%), 0 skipped, 0 failed
- Chunks: 42
- Duration: 2067 ms

## Configuration

- Embedding identity: ollama/nomic-embed-text
- Query prefix: "", document prefix: ""
- Chunks: up to 2000 characters, 200 overlap, chunking version markdown-1, text-1
- Candidates per search: 40, RRF k: 60, HNSW ef_search: 100
