import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns';

export const repositories = pgTable(
  'repositories',
  {
    id: id(),
    name: text('name').notNull(),
    canonicalPath: text('canonical_path').notNull().unique(),
    privacyMode: text('privacy_mode').notNull().default('local'),
    status: text('status').notNull().default('registered'),
    lastIndexedCommit: text('last_indexed_commit'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      'repositories_privacy_mode_check',
      sql`${t.privacyMode} in ('local')`,
    ),
    check(
      'repositories_status_check',
      sql`${t.status} in ('registered', 'indexing', 'ready', 'failed')`,
    ),
  ],
);
