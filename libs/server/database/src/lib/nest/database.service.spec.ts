import { Logger } from '@nestjs/common';
import { loadConfig } from '@codebase-ai/server-config';
import { DatabaseNotConfiguredError } from './database-not-configured.error';
import { DatabaseService } from './database.service';

describe('DatabaseService without a live database', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports unconfigured when DATABASE_URL is unset', async () => {
    const service = new DatabaseService(loadConfig({}));
    await expect(service.checkHealth()).resolves.toEqual({
      status: 'unconfigured',
      vectorExtension: false,
      embeddingDimensions: null,
    });
    expect(() => service.db).toThrow(DatabaseNotConfiguredError);
  });

  it('reports down without leaking the connection string', async () => {
    const password = 'canary-db-password';
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new DatabaseService(
      loadConfig({
        DATABASE_URL: `postgres://user:${password}@127.0.0.1:1/unreachable`,
      }),
    );
    try {
      await expect(service.checkHealth()).resolves.toMatchObject({
        status: 'down',
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain(password);
    } finally {
      await service.onApplicationShutdown();
    }
  });
});
