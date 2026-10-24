import type { Database } from '../../lib/connection/create-database';

/** Pass `{ transient: { db } }` to `.create()` so the factory can insert the row. */
export interface DatabaseTransientParams {
  db?: Database;
}

export function requireDatabase(params: DatabaseTransientParams): Database {
  if (!params.db) {
    throw new Error('Pass { transient: { db } } to create() to insert rows');
  }
  return params.db;
}
