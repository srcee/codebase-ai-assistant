import type { AppConfig } from '@codebase-ai/server-config';
import type { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import { InferenceUnavailableError } from '../../errors/inference-unavailable.error';
import type { EmbeddingPort } from '../../types/embedding-port';
import type { InferenceRequestOptions } from '../../types/inference-request-options';
import { toInferenceError } from '../../utils/to-inference-error';
import type {
  OllamaEmbedRequest,
  OllamaEmbedResponse,
} from './ollama-wire.types';

export class OllamaEmbedding implements EmbeddingPort {
  constructor(
    private readonly egress: EgressHttpClient,
    private readonly config: AppConfig,
  ) {}

  async embedBatch(
    texts: readonly string[],
    options: InferenceRequestOptions = {},
  ): Promise<number[][]> {
    const model = this.config.inference.embeddingModel;
    // Ollama truncates silently by default; an oversized chunk must fail instead.
    const request: OllamaEmbedRequest = {
      model,
      input: [...texts],
      truncate: false,
    };
    let response: OllamaEmbedResponse;
    try {
      response = await this.egress.postJson<OllamaEmbedResponse>(
        '/api/embed',
        request,
        { signal: options.signal },
      );
    } catch (error) {
      throw toInferenceError(error, model);
    }
    const embeddings = response?.embeddings;
    if (!isVectorList(embeddings)) {
      throw new InferenceUnavailableError('invalid-response');
    }
    return embeddings;
  }
}

function isVectorList(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (vector) =>
        Array.isArray(vector) &&
        vector.every((component) => typeof component === 'number'),
    )
  );
}
