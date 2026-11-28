import type { DocumentSummary } from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type DocumentRow = typeof schema.documents.$inferSelect;

/** Deliberately omits the blob hash, which locates the original in DATA_DIR. */
export function toDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    logicalPath: row.logicalPath,
    sizeBytes: row.sizeBytes,
    mediaType: row.mediaType,
    updatedAt: row.updatedAt.toISOString(),
  };
}
