import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { DatabaseModule } from '@codebase-ai/server-database';
import { HealthModule } from './modules/health/health.module';
import { CodebasesModule } from './modules/codebases/codebases.module';

@Global()
@Module({
  imports: [DatabaseModule, HealthModule, CodebasesModule],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppModule {}
