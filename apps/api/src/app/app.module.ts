import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { DatabaseModule } from '@codebase-ai/server-database';
import { RepositoriesModule } from '@codebase-ai/server-repositories';
import { HealthController } from './health.controller';

@Global()
@Module({
  imports: [DatabaseModule, RepositoriesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppModule {}
