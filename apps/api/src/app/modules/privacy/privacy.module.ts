import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { INFERENCE_PROVIDERS } from './constants/inference-providers';
import { EgressHttpClient } from './services/egress-http-client.service';
import { INFERENCE_ENDPOINT } from './types/inference-endpoint';

@Module({
  providers: [
    {
      provide: INFERENCE_ENDPOINT,
      inject: [APP_CONFIG],
      // A rejected URL fails module initialization, so the API never starts.
      useFactory: (config: AppConfig) =>
        INFERENCE_PROVIDERS[config.inference.provider](
          config.inference.baseUrl,
        ),
    },
    EgressHttpClient,
  ],
  exports: [EgressHttpClient],
})
export class PrivacyModule {}
