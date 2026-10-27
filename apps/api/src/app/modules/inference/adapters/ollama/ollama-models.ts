import type { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import type { RuntimeHealthPort } from '../../types/runtime-health-port';
import { toInferenceError } from '../../utils/to-inference-error';
import type { OllamaTagsResponse } from './ollama-wire.types';

const HEALTH_TIMEOUT_MS = 3000;

export class OllamaModels implements RuntimeHealthPort {
  constructor(private readonly egress: EgressHttpClient) {}

  async availableModels(names: readonly string[]): Promise<boolean[]> {
    let tags: OllamaTagsResponse;
    try {
      tags = await this.egress.getJson<OllamaTagsResponse>('/api/tags', {
        timeoutMs: HEALTH_TIMEOUT_MS,
      });
    } catch (error) {
      throw toInferenceError(error);
    }
    const pulled = new Set<unknown>();
    for (const model of tags?.models ?? []) {
      pulled.add(model.name);
      pulled.add(model.model);
    }
    // Ollama stores an untagged pull as `<name>:latest`.
    return names.map(
      (name) =>
        pulled.has(name) ||
        (!name.includes(':') && pulled.has(`${name}:latest`)),
    );
  }
}
