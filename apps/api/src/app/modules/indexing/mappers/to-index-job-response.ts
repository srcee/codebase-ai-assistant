import type { IndexJobResponse } from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type IndexJobRow = typeof schema.indexJobs.$inferSelect;

export function toIndexJobResponse(row: IndexJobRow): IndexJobResponse {
  return {
    id: row.id,
    codebaseId: row.repositoryId,
    status: row.status as IndexJobResponse['status'],
    filesDiscovered: row.filesDiscovered,
    filesIndexed: row.filesIndexed,
    filesSkipped: row.filesSkipped,
    filesFailed: row.filesFailed,
    chunksWritten: row.chunksWritten,
    errorSummary: row.errorSummary,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
