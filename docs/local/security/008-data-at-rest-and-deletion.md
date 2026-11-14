# Security 008: Indexed data at rest and after deletion

- **Status:** Open
- **Severity:** Medium
- **Area:** `docker-compose.yml` (`pgdata` volume), codebases delete flow, README
- **Target stage:** 10

## Problem

- Chunks, embeddings, and chat history are stored as plaintext in the Postgres `pgdata` volume. Anyone with access to the Docker volume or a disk image can read them.
- Deleting a repository cascades rows, but Postgres keeps dead tuples on disk until `VACUUM` reclaims them, and WAL may hold copies for a while. Users may expect deletion to be immediate.

## Proposed fix

- Document that data at rest relies on OS disk encryption (BitLocker, FileVault, LUKS) and on volume permissions.
- Document deletion semantics: rows are gone from queries immediately; physical removal follows autovacuum. Offer `VACUUM` on the affected tables after repository deletion (or a documented manual command).
- Document how to wipe everything (`npm run db:reset` / removing the volume).

## Tests

- Repository deletion leaves no rows in `repository_files`, `code_chunks`, `index_jobs` (already covered; keep).

## Related

- [../improvements/005-chat-retention-and-backups.md](../improvements/005-chat-retention-and-backups.md)
