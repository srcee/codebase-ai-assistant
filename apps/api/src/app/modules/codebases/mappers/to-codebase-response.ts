import type { CodebaseResponse } from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type CodebaseRow = typeof schema.repositories.$inferSelect;

/** Deliberately omits the canonical absolute path. */
export function toCodebaseResponse(
  row: CodebaseRow,
  relativePath: string | null,
): CodebaseResponse {
  return {
    id: row.id,
    name: row.name,
    relativePath,
    status: row.status as CodebaseResponse['status'],
    lastIndexedCommit: row.lastIndexedCommit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
