# Improvement 005: Chat retention and backups

- **Status:** Open
- **Severity:** Medium
- **Area:** Stage 9 retention decision, README
- **Target stage:** 8 (retention), 10 (backups doc)

## Problem

- Stage 9 lists conversation retention as an open decision. Chats may contain code excerpts, so retention is a privacy question, not just a feature.
- There is no backup or restore guidance. A lost `pgdata` volume means re-registering and re-indexing everything and losing chat history.

## Proposed fix

- Retention decision (Stage 9): default to keeping conversations until deleted; add `CHAT_RETENTION_DAYS` (unset = keep) and a startup/periodic purge; delete removes messages and citations in one transaction.
- "Delete all conversations" endpoint for a quick wipe.
- Backups (README): `pg_dump` / `pg_restore` commands for the compose database; dumps contain source code, so store them with the same care as the repositories; never commit them (`*.dump`, `*.sql.gz` in `.gitignore`).
- Note that re-indexing rebuilds chunks and embeddings, so only conversations really need a backup.

## Tests

- Purge removes conversations older than the retention window and keeps newer ones.
- Delete-all leaves no rows in `conversations`, `messages`, `message_citations`.

## Related

- [../security/008-data-at-rest-and-deletion.md](../security/008-data-at-rest-and-deletion.md)
