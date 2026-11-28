import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  DocumentChangesResponse,
  DocumentOrigin,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { DOCUMENT_CHUNKING_VERSIONS } from '../../document-ingestion/constants/chunking-versions';
import { CollectionDiscoveryService } from '../../document-ingestion/services/collection-discovery.service';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { SOURCE_NOT_FOUND } from '../constants/job-messages';
import { isUnchanged } from '../utils/is-unchanged';

const { sources, sourceFiles } = schema;

/** Tells what a sync would change, with the same unchanged rule as the indexer. */
@Injectable()
export class SourceChangesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly discovery: CollectionDiscoveryService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Hashes folder files or reads upload rows; nothing is parsed or embedded. */
  async changes(collectionId: string): Promise<DocumentChangesResponse> {
    const [collection] = await this.database.db
      .select({
        id: sources.id,
        origin: sources.origin,
        canonicalPath: sources.canonicalPath,
      })
      .from(sources)
      .where(
        and(
          eq(sources.id, collectionId),
          eq(sources.kind, 'document_collection'),
        ),
      );
    if (!collection) {
      throw new NotFoundException(SOURCE_NOT_FOUND.document_collection);
    }
    const rows = await this.database.db
      .select({
        relativePath: sourceFiles.relativePath,
        status: sourceFiles.status,
        contentHash: sourceFiles.contentHash,
        embeddingModel: sourceFiles.embeddingModel,
        chunkingVersion: sourceFiles.chunkingVersion,
      })
      .from(sourceFiles)
      .where(eq(sourceFiles.sourceId, collectionId));
    const stored = new Map(rows.map((row) => [row.relativePath, row]));

    const present = new Set<string>();
    const counts: DocumentChangesResponse = { new: 0, changed: 0, removed: 0 };
    for await (const entry of this.discovery.discover({
      ...collection,
      origin: collection.origin as DocumentOrigin | null,
    })) {
      if (entry.status !== 'included') continue;
      present.add(entry.relativePath);
      const row = stored.get(entry.relativePath);
      if (!row) counts.new++;
      else if (
        !isUnchanged(row, {
          contentHash: entry.contentHash,
          embeddingModel: this.embeddings.identity,
          chunkingVersion: DOCUMENT_CHUNKING_VERSIONS[entry.format.id],
        })
      ) {
        counts.changed++;
      }
    }
    counts.removed = rows.filter(
      (row) => row.status === 'indexed' && !present.has(row.relativePath),
    ).length;
    return counts;
  }
}
