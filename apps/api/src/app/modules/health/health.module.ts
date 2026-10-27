import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { InferenceModule } from '../inference/inference.module';
import { HealthController } from './controllers/health.controller';
import { InferenceHealthService } from './services/inference-health.service';

@Module({
  imports: [DatabaseModule, InferenceModule],
  controllers: [HealthController],
  providers: [InferenceHealthService],
})
export class HealthModule {}
