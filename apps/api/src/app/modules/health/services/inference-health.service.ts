import { Inject, Injectable } from '@nestjs/common';
import type { InferenceHealth } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import {
  RUNTIME_HEALTH_PORT,
  type RuntimeHealthPort,
} from '../../inference/types/runtime-health-port';

@Injectable()
export class InferenceHealthService {
  constructor(
    @Inject(RUNTIME_HEALTH_PORT) private readonly runtime: RuntimeHealthPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async check(): Promise<InferenceHealth> {
    const { provider, runtime, embeddingModel, chatModel } =
      this.config.inference;
    try {
      const [embeddingAvailable, chatAvailable] =
        await this.runtime.availableModels([embeddingModel, chatModel]);
      return {
        provider,
        runtime,
        status: 'up',
        embeddingModel: { name: embeddingModel, available: embeddingAvailable },
        chatModel: { name: chatModel, available: chatAvailable },
      };
    } catch {
      return {
        provider,
        runtime,
        status: 'down',
        embeddingModel: { name: embeddingModel, available: false },
        chatModel: { name: chatModel, available: false },
      };
    }
  }
}
