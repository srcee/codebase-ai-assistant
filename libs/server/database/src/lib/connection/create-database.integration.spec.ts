import { sql } from 'drizzle-orm';
import { describeWithDatabase, prepareDedicatedDatabase } from '../../testing';
import { createDatabase, type DatabaseHandle } from './create-database';
import { isStatementTimeoutError } from './is-statement-timeout-error';

// A dedicated database keeps this suite clear of the schema suite, which drops the public schema.
describeWithDatabase('database pool settings', (baseUrl) => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    const prepared = await prepareDedicatedDatabase(baseUrl, 'pool');
    await prepared.handle.pool.end();
    handle = createDatabase(prepared.url, {
      poolMax: 2,
      idleTimeoutMs: 1000,
      statementTimeoutMs: 250,
    });
  });

  afterAll(async () => {
    await handle?.pool.end();
  });

  it('cancels a statement that runs past the timeout', async () => {
    const error = await handle.db
      .execute(sql`select pg_sleep(3)`)
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
