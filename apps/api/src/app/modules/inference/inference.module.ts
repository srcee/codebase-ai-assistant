import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { PrivacyModule } from '../privacy/privacy.module';
import { EgressHttpClient } from '../privacy/services/egress-http-client.service';
import { RUNTIME_ADAPTERS } from './constants/runtime-adapters';
import { CHAT_PORT } from './types/chat-port';
import { EMBEDDING_PORT } from './types/embedding-port';
import { INFERENCE_RUNTIME_ADAPTER } from './types/inference-runtime-adapter';
import { RUNTIME_HEALTH_PORT } from './types/runtime-health-port';

/** Plugs in the adapter of INFERENCE_RUNTIME. Consumers inject the ports, never the adapter. */
@Module({
  imports: [PrivacyModule],
  providers: [
    {
      provide: INFERENCE_RUNTIME_ADAPTER,
      inject: [EgressHttpClient, APP_CONFIG],
      useFactory: (egress: EgressHttpClient, config: AppConfig) =>
        new RUNTIME_ADAPTERS[config.inference.runtime](egress, config),
    },
    { provide: EMBEDDING_PORT, useExisting: INFERENCE_RUNTIME_ADAPTER },
    { provide: CHAT_PORT, useExisting: INFERENCE_RUNTIME_ADAPTER },
    { provide: RUNTIME_HEALTH_PORT, useExisting: INFERENCE_RUNTIME_ADAPTER },
  ],
  exports: [EMBEDDING_PORT, CHAT_PORT, RUNTIME_HEALTH_PORT],
})
export class InferenceModule {}
