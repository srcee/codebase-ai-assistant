import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  pool: Pool;
  db: Database;
}

export interface PoolSettings {
  poolMax: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
}

export function createDatabase(
  connectionString: string,
  settings?: PoolSettings,
): DatabaseHandle {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3000,
    ...(settings && {
      max: settings.poolMax,
      idleTimeoutMillis: settings.idleTimeoutMs,
      statement_timeout: settings.statementTimeoutMs,
    }),
  });
  // Idle-client errors would otherwise crash the process; they surface on the next query.
  pool.on('error', () => undefined);
  return { pool, db: drizzle(pool, { schema }) };
}
