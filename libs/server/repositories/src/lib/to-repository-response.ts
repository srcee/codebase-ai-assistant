import type { RepositoryResponse } from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type RepositoryRow = typeof schema.repositories.$inferSelect;

/** Deliberately omits the canonical absolute path. */
export function toRepositoryResponse(
  row: RepositoryRow,
  relativePath: string | null,
): RepositoryResponse {
  return {
    id: row.id,
    name: row.name,
    relativePath,
    status: row.status as RepositoryResponse['status'],
    lastIndexedCommit: row.lastIndexedCommit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
