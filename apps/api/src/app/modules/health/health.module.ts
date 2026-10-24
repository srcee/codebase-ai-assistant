import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { HealthController } from './controllers/health.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
