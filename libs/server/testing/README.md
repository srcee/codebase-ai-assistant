# server-testing

Test-only helpers for server code: a temporary sandbox with git repositories and directory links, and a config builder.

- Import it only from `*.spec.*` files and `src/testing/**`; ESLint enforces this.
- Database factories and integration-database helpers live in `libs/server/database/src/testing` (`@codebase-ai/server-database/testing`), because they depend on the schema and a separate library would create a dependency cycle.
