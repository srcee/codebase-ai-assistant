import type {
  DocumentCollectionResponse,
  DocumentOrigin,
  SourceStatus,
} from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';

type SourceRow = typeof schema.sources.$inferSelect;

/** Deliberately omits the canonical absolute path. */
export function toDocumentCollectionResponse(
  row: SourceRow,
  relativePath: string | null,
): DocumentCollectionResponse {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin as DocumentOrigin,
    relativePath,
    status: row.status as SourceStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
