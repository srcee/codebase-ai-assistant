import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { DatabaseModule } from '@codebase-ai/server-database';
import { HealthModule } from './modules/health/health.module';
import { CodebasesModule } from './modules/codebases/codebases.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { GenerationModule } from './modules/generation/generation.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    PrivacyModule,
    EmbeddingsModule,
    GenerationModule,
    HealthModule,
    CodebasesModule,
    IngestionModule,
  ],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppModule {}
