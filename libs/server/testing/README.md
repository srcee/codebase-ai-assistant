# server-testing

Test-only helpers for server code: a temporary sandbox with git repositories and directory links, a config builder, and a synthetic sample repository for ingestion tests.

- Import it only from `*.spec.*` files and `src/testing/**`; ESLint enforces this.
- `buildSampleRepository(sandbox)` writes a repository into the sandbox at test time: source files of each supported language, a malformed and an invalid-UTF-8 file, oversized and long-line files, excluded directories, lockfiles, a binary, secret files and a secret-looking assignment holding `CANARY_SECRET`, nested `.gitignore` files, and junctions pointing inside and outside the repository. Nothing is committed as a file because `.gitignore` blocks secret names and Windows cannot reliably commit links.
- Fixture text is fixed rather than generated with faker so snapshots stay stable.
- `FakeLoopbackServer.start()` serves a scriptable HTTP server on 127.0.0.1 with a random port. It records requests and answers per `method path` handlers (`respondJson`, `respondNdjson`, `respondLines`); unknown paths return 404. It knows no runtime.
- `buildEmbeddingVectors(count, dimensions)` builds random vectors for any runtime.
- `urlWithCredentials(baseUrl, password?)` adds a faker username and password to a URL at runtime. Use it instead of writing `user:password@host` literals, which the secretlint pre-commit hook rejects as real credentials.
- Runtime-specific response factories live in a folder per runtime, for example `src/lib/ollama/` (`ollamaEmbedResponseFactory`, `ollamaTagsResponseFactory`, `ollamaChatChunkFactory`). Use them only in that runtime's adapter specs.
- Database factories and integration-database helpers live in `libs/server/database/src/testing` (`@codebase-ai/server-database/testing`), because they depend on the schema and a separate library would create a dependency cycle.
