import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppModule {}
