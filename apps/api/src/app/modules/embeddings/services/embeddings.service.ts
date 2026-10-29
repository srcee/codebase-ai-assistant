import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import {
  EMBEDDING_PORT,
  type EmbeddingPort,
} from '../../inference/types/embedding-port';
import type { InferenceRequestOptions } from '../../inference/types/inference-request-options';
import { RETRY_BASE_DELAY_MS } from '../constants/retry-policy';
import { EmbeddingDimensionMismatchError } from '../errors/embedding-dimension-mismatch.error';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Runtime-agnostic embedding entry point: batching, bounded retries and vector checks. */
@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(EMBEDDING_PORT) private readonly port: EmbeddingPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** `<runtime>/<model>`; stored with every vector so a change forces a re-index. */
  get identity(): string {
    const { runtime, embeddingModel } = this.config.inference;
    return `${runtime}/${embeddingModel}`;
  }

  /** Returns one vector per input, in order. */
  async embed(
    texts: readonly string[],
    options: InferenceRequestOptions = {},
  ): Promise<number[][]> {
    const { embeddingBatchSize } = this.config.inference;
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += embeddingBatchSize) {
      const batch = texts.slice(start, start + embeddingBatchSize);
      vectors.push(...(await this.embedBatch(batch, options)));
    }
    return vectors;
  }

  private async embedBatch(
    batch: readonly string[],
    options: InferenceRequestOptions,
  ): Promise<number[][]> {
    const { maxRetries } = this.config.inference;
    for (let attempt = 0; ; attempt++) {
      try {
        return this.validate(
          await this.port.embedBatch(batch, options),
          batch.length,
        );
      } catch (error) {
        const retryable =
          error instanceof InferenceUnavailableError && error.retryable;
        if (!retryable || attempt >= maxRetries || options.signal?.aborted) {
          throw error;
        }
        await wait(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }

  private validate(vectors: number[][], expectedCount: number): number[][] {
    if (vectors.length !== expectedCount) {
      throw new InferenceUnavailableError('invalid-response');
    }
    const expected = this.config.inference.embeddingDimensions;
    for (const vector of vectors) {
      if (vector.length !== expected) {
        throw new EmbeddingDimensionMismatchError(expected, vector.length);
      }
    }
    return vectors;
  }
}
