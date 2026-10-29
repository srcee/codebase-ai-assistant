import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { faker } from '@codebase-ai/shared-testing';

/** The token every test app accepts; unseeded, so assert on this value, never a literal. */
export const TEST_API_TOKEN = faker.string.alphanumeric(43);

export const bearer = (token: string): string => `Bearer ${token}`;

/** A supertest agent that sends the test token on every request. */
export function authorizedAgent(app: INestApplication) {
  return request.agent(app.getHttpServer()).set({
    Authorization: bearer(TEST_API_TOKEN),
  });
}
