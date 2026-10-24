import { Logger } from '@nestjs/common';
import { loadConfig } from '@codebase-ai/server-config';
import {
  assertNotLeaked,
  CANARY_DB_PASSWORD,
  databaseHealthFactory,
  faker,
} from '@codebase-ai/shared-testing';
import { DatabaseNotConfiguredError } from './database-not-configured.error';
import { DatabaseService } from './database.service';

describe('DatabaseService without a live database', () => {
  it('reports unconfigured when DATABASE_URL is unset', async () => {
    const service = new DatabaseService(loadConfig({}));
    await expect(service.checkHealth()).resolves.toEqual(
      databaseHealthFactory.unconfigured().build(),
    );
    expect(() => service.db).toThrow(DatabaseNotConfiguredError);
  });

  it('reports down without leaking the connection string', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const user = faker.internet.username();
    const service = new DatabaseService(
      loadConfig({
        DATABASE_URL: `postgres://${user}:${CANARY_DB_PASSWORD}@127.0.0.1:1/unreachable`,
      }),
    );
    try {
      await expect(service.checkHealth()).resolves.toMatchObject({
        status: 'down',
      });
      assertNotLeaked(warn.mock.calls, CANARY_DB_PASSWORD);
    } finally {
      await service.onApplicationShutdown();
    }
  });
});
