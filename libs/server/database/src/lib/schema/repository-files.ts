import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { id } from './columns';
import { repositories } from './repositories';

export const repositoryFiles = pgTable(
  'repository_files',
  {
    id: id(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(),
    contentHash: text('content_hash').notNull(),
    language: text('language'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: text('status').notNull(),
    statusReason: text('status_reason'),
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
  },
  (t) => [
    unique('repository_files_repository_path_key').on(
      t.repositoryId,
      t.relativePath,
    ),
    // Lets chunks reference (file, repository) so a chunk cannot point at another repository's file.
    unique('repository_files_id_repository_key').on(t.id, t.repositoryId),
    check('repository_files_size_check', sql`${t.sizeBytes} >= 0`),
    check(
      'repository_files_status_check',
      sql`${t.status} in ('indexed', 'skipped', 'failed')`,
    ),
  ],
);
