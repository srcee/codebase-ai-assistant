import { sql } from 'drizzle-orm';
import { describeWithDatabase } from '../../testing';
import { createDatabase, type DatabaseHandle } from './create-database';
import { isStatementTimeoutError } from './is-statement-timeout-error';

describeWithDatabase('database pool settings', (url) => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDatabase(url, {
      poolMax: 2,
      idleTimeoutMs: 1000,
      statementTimeoutMs: 100,
    });
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('cancels a statement that runs past the timeout', async () => {
    const error = await handle.db
      .execute(sql`select pg_sleep(2)`)
      .then(() => undefined)
      .catch((e: unknown) => e);
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it('keeps serving queries after a timeout', async () => {
    const result = await handle.db.execute<{ one: number }>(
      sql`select 1 as one`,
    );
    expect(result.rows[0].one).toBe(1);
  });

  it('applies the pool settings', () => {
    expect(handle.pool.options.max).toBe(2);
    expect(handle.pool.options.idleTimeoutMillis).toBe(1000);
  });
});
