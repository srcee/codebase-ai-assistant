import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { DatabaseModule } from '@codebase-ai/server-database';
import { ApiTokenGuard } from './guards/api-token.guard';
import { LoopbackRequestGuard } from './guards/loopback-request.guard';
import {
  ALL_ROUTES_PATH,
  restoreRequestContextMiddleware,
} from './middleware/restore-request-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CodebasesModule } from './modules/codebases/codebases.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { GenerationModule } from './modules/generation/generation.module';
import { IndexingModule } from './modules/indexing/indexing.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PrivacyModule,
    EmbeddingsModule,
    GenerationModule,
    HealthModule,
    CodebasesModule,
    IngestionModule,
    IndexingModule,
  ],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    // Order matters: the request origin is checked before the token.
    { provide: APP_GUARD, useClass: LoopbackRequestGuard },
    { provide: APP_GUARD, useClass: ApiTokenGuard },
  ],
  exports: [APP_CONFIG],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(restoreRequestContextMiddleware)
      .forRoutes({ path: ALL_ROUTES_PATH, method: RequestMethod.ALL });
  }
}
