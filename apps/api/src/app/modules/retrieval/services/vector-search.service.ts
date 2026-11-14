import { Inject, Injectable } from '@nestjs/common';
import { and, cosineDistance, eq, inArray, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { SearchCandidate } from '../types/search-candidate';
import { toSearchCandidate } from '../mappers/search-candidate.mapper';
import { candidateColumns } from '../utils/candidate-columns';

const { chunks, sources, sourceFiles } = schema;

export interface VectorSearchParams {
  vector: readonly number[];
  sourceIds: readonly string[];
  /** Only vectors from this embedding identity are comparable. */
  embeddingModel: string;
}

@Injectable()
export class VectorSearchService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(params: VectorSearchParams): Promise<SearchCandidate[]> {
    if (params.sourceIds.length === 0) return [];
    const { candidateLimit, hnswEfSearch } = this.config.retrieval;
    const distance = cosineDistance(chunks.embedding, [...params.vector]);

    const rows = await this.database.db.transaction(async (tx) => {
      // Without iterative scans the source filter can leave an HNSW scan with too few rows.
      await tx.execute(
        sql`select set_config('hnsw.iterative_scan', 'relaxed_order', true), set_config('hnsw.ef_search', ${String(hnswEfSearch)}, true)`,
      );
      return tx
        .select({ ...candidateColumns, distance })
        .from(chunks)
        .innerJoin(
          sourceFiles,
          and(
            eq(sourceFiles.id, chunks.fileId),
            eq(sourceFiles.sourceId, chunks.sourceId),
          ),
        )
        .innerJoin(sources, eq(sources.id, chunks.sourceId))
        .where(
          and(
            inArray(chunks.sourceId, [...params.sourceIds]),
            eq(chunks.embeddingModel, params.embeddingModel),
          ),
        )
        .orderBy(distance, chunks.id)
        .limit(candidateLimit);
    });

    // Relaxed-order scans may return rows slightly out of order.
    return rows
      .sort((a, b) => Number(a.distance) - Number(b.distance))
      .map(({ distance, ...row }) => ({
        ...toSearchCandidate(row),
        vectorSimilarity: 1 - Number(distance),
      }));
  }
}
