import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { bigint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { repositories } from '../repositories/table';
import { id } from '../shared/columns';

export const columns = {
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
};

export type Columns = BuildExtraConfigColumns<
  'repository_files',
  typeof columns,
  'pg'
>;
