import type { InferenceRequestOptions } from './inference-request-options';

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

/** One runtime call per batch. Batching, retries and dimension checks live in EmbeddingsService. */
export interface EmbeddingPort {
  /** One vector per input, in order. Must fail, never truncate, when an input exceeds the model context. */
  embedBatch(
    texts: readonly string[],
    options?: InferenceRequestOptions,
  ): Promise<number[][]>;
}
