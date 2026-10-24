import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
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
};

export type Columns = BuildExtraConfigColumns<
  'repositories',
  typeof columns,
  'pg'
>;
