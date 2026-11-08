import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import type { InferenceRequestOptions } from '../../inference/types/inference-request-options';
import type { RetrievedChunk } from '../types/retrieved-chunk';
import { applyContextBudget } from '../utils/apply-context-budget';
import { reciprocalRankFusion } from '../utils/reciprocal-rank-fusion';
import { LexicalSearchService } from './lexical-search.service';
import { VectorSearchService } from './vector-search.service';

export interface RetrievalRequest {
  query: string;
  /** Only these repositories are searched; empty or unknown ids yield no results. */
  repositoryIds: readonly string[];
}

/** Hybrid search: vector and full-text candidates fused with RRF, then cut to the context budget. */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly vectorSearch: VectorSearchService,
    private readonly lexicalSearch: LexicalSearchService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(
    request: RetrievalRequest,
    options: InferenceRequestOptions = {},
  ): Promise<RetrievedChunk[]> {
    const repositoryIds = [...new Set(request.repositoryIds)];
    const query = request.query.trim();
    if (repositoryIds.length === 0 || query === '') return [];

    const started = process.hrtime.bigint();
    const vector = await this.embeddings.embedQuery(query, options);
    const [vectorResults, lexicalResults] = await Promise.all([
      this.vectorSearch.search({
        vector,
        repositoryIds,
        embeddingModel: this.embeddings.identity,
      }),
      this.lexicalSearch.search(query, repositoryIds),
    ]);

    const { rrfK, maxChunks, maxContextChars } = this.config.retrieval;
    const results = applyContextBudget(
      reciprocalRankFusion(vectorResults, lexicalResults, rrfK),
      { maxChunks, maxContextChars },
    );

    const durationMs = Math.round(
      Number(process.hrtime.bigint() - started) / 1e6,
    );
    // Counts and timing only: the query text can hold pasted source code.
    this.logger.log(
      `search repositories=${repositoryIds.length} vector=${vectorResults.length} lexical=${lexicalResults.length} results=${results.length} ${durationMs}ms`,
    );
    return results;
  }
}
