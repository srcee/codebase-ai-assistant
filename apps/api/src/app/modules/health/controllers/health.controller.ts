import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService } from '@codebase-ai/server-database';
import { InferenceHealthService } from '../services/inference-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly inferenceHealth: InferenceHealthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const [database, inference] = await Promise.all([
      this.database.checkHealth(),
      this.inferenceHealth.check(),
    ]);
    const healthy =
      database.status === 'up' &&
      database.vectorExtension &&
      database.embeddingDimensions ===
        this.config.inference.embeddingDimensions &&
      inference.status === 'up' &&
      inference.embeddingModel.available &&
      inference.chatModel.available;
    if (!healthy) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'degraded', database, inference };
  }
}
