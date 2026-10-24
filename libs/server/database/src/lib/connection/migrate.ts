import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './create-database';

// Resolved from the source tree; migrations are applied by `npm run db:migrate` and tests, not by the API bundle.
export const MIGRATIONS_FOLDER = join(
  __dirname,
  '..',
  '..',
  '..',
  'migrations',
);

export function runMigrations(db: Database): Promise<void> {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
