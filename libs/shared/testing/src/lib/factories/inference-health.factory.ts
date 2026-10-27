import { Factory } from 'fishery';
import type { InferenceHealth } from '@codebase-ai/contracts';

class InferenceHealthFactory extends Factory<InferenceHealth> {
  down() {
    return this.params({
      status: 'down',
      embeddingModel: { available: false },
      chatModel: { available: false },
    });
  }

  embeddingModelMissing() {
    return this.params({ embeddingModel: { available: false } });
  }

  chatModelMissing() {
    return this.params({ chatModel: { available: false } });
  }
}

/** Defaults to a reachable runtime with both default models pulled. */
export const inferenceHealthFactory = InferenceHealthFactory.define(
  (): InferenceHealth => ({
    provider: 'local',
    runtime: 'ollama',
    status: 'up',
    embeddingModel: { name: 'nomic-embed-text', available: true },
    chatModel: { name: 'qwen2.5-coder:7b', available: true },
  }),
);
