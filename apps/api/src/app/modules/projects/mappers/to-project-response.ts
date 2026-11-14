import type { ProjectResponse } from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type ProjectRow = typeof schema.projects.$inferSelect;

export function toProjectResponse(
  row: ProjectRow,
  sourceIds: readonly string[],
): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceIds: [...sourceIds],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
