import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  createDatabase,
  type DatabaseHandle,
} from '../lib/connection/create-database';
import { runMigrations } from '../lib/connection/migrate';

const DISPOSABLE_NAME = /^[a-z0-9_]+_test$/;

export function loadTestEnv(): void {
  const envFile = join(__dirname, '..', '..', '..', '..', '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function testDatabaseUrl(): string | undefined {
  loadTestEnv();
  return process.env['TEST_DATABASE_URL'];
}

/** Runs the suite only when TEST_DATABASE_URL is set; otherwise registers it as skipped. */
export function describeWithDatabase(
  name: string,
  suite: (databaseUrl: string) => void,
): void {
  const url = testDatabaseUrl();
  if (url) {
    describe(name, () => suite(url));
    return;
  }
  console.warn(`TEST_DATABASE_URL is not set; skipping "${name}".`);
  describe.skip(name, () => suite(''));
}

// Suites drop the public schema, so refuse anything that is not clearly disposable.
export function assertDisposableDatabase(connectionString: string): void {
  const name = new URL(connectionString).pathname.slice(1);
  if (!DISPOSABLE_NAME.test(name)) {
    throw new Error(
      'TEST_DATABASE_URL must point at a database whose name ends in _test',
    );
  }
}

export async function resetSchema(handle: DatabaseHandle): Promise<void> {
  await handle.pool.query('drop schema if exists public cascade');
  await handle.pool.query('drop schema if exists drizzle cascade');
  await handle.pool.query('create schema public');
}

export interface DedicatedDatabase {
  handle: DatabaseHandle;
  url: string;
}

/**
 * Creates (if needed) a database named after the base one plus `suffix`, resets it, and migrates it,
 * so suites that run in parallel under Nx never share a schema.
 */
export async function prepareDedicatedDatabase(
  baseUrl: string,
  suffix: string,
): Promise<DedicatedDatabase> {
  assertDisposableDatabase(baseUrl);
  const url = new URL(baseUrl);
  const baseName = url.pathname.slice(1).replace(/_test$/, '');
  const dedicatedName = `${baseName}_${suffix}_test`;

  const admin = new Pool({ connectionString: baseUrl });
  try {
    const existing = await admin.query(
      'select 1 from pg_database where datname = $1',
      [dedicatedName],
    );
    if (existing.rowCount === 0) {
      await admin.query(`create database "${dedicatedName}"`);
    }
  } finally {
    await admin.end();
  }

  url.pathname = `/${dedicatedName}`;
  const handle = createDatabase(url.toString());
  await resetSchema(handle);
  await runMigrations(handle.db);
  return { handle, url: url.toString() };
}
