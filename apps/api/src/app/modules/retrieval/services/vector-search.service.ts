import { Inject, Injectable } from '@nestjs/common';
import { and, cosineDistance, eq, inArray, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { SearchCandidate } from '../types/search-candidate';
import { candidateColumns } from '../utils/candidate-columns';

const { codeChunks, repositories, repositoryFiles } = schema;

export interface VectorSearchParams {
  vector: readonly number[];
  repositoryIds: readonly string[];
  /** Only vectors from this embedding identity are comparable. */
  embeddingModel: string;
}

/** Nearest chunks by cosine distance within the given repositories. */
@Injectable()
export class VectorSearchService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(params: VectorSearchParams): Promise<SearchCandidate[]> {
    if (params.repositoryIds.length === 0) return [];
    const { candidateLimit, hnswEfSearch } = this.config.retrieval;
    const distance = cosineDistance(codeChunks.embedding, [...params.vector]);

    const rows = await this.database.db.transaction(async (tx) => {
      // Without iterative scans the repository filter can leave an HNSW scan with too few rows.
      await tx.execute(
        sql`select set_config('hnsw.iterative_scan', 'relaxed_order', true), set_config('hnsw.ef_search', ${String(hnswEfSearch)}, true)`,
      );
      return tx
        .select({ ...candidateColumns, distance })
        .from(codeChunks)
        .innerJoin(
          repositoryFiles,
          and(
            eq(repositoryFiles.id, codeChunks.fileId),
            eq(repositoryFiles.repositoryId, codeChunks.repositoryId),
          ),
        )
        .innerJoin(repositories, eq(repositories.id, codeChunks.repositoryId))
        .where(
          and(
            inArray(codeChunks.repositoryId, [...params.repositoryIds]),
            eq(codeChunks.embeddingModel, params.embeddingModel),
          ),
        )
        .orderBy(distance, codeChunks.id)
        .limit(candidateLimit);
    });

    // Relaxed-order scans may return rows slightly out of order.
    return rows
      .sort((a, b) => Number(a.distance) - Number(b.distance))
      .map(({ distance: _distance, ...candidate }) => candidate);
  }
}
