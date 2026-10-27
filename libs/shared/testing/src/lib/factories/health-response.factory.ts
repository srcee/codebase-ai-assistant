import { Factory } from 'fishery';
import type { HealthResponse } from '@codebase-ai/contracts';
import { databaseHealthFactory } from './database-health.factory';
import { inferenceHealthFactory } from './inference-health.factory';

class HealthResponseFactory extends Factory<HealthResponse> {
  degraded() {
    return this.params({
      status: 'degraded',
      database: databaseHealthFactory.down().build(),
    });
  }
}

export const healthResponseFactory = HealthResponseFactory.define(
  (): HealthResponse => ({
    status: 'ok',
    database: databaseHealthFactory.build(),
    inference: inferenceHealthFactory.build(),
  }),
);
