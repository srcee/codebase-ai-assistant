import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  pool: Pool;
  db: Database;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  // Idle-client errors would otherwise crash the process; they surface on the next query.
  pool.on('error', () => undefined);
  return { pool, db: drizzle(pool, { schema }) };
}
