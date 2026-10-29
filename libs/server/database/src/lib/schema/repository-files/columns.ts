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
  contentHash: text('content_hash'),
  language: text('language'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  status: text('status').notNull(),
  statusReason: text('status_reason'),
  embeddingModel: text('embedding_model'),
  chunkingVersion: text('chunking_version'),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
};

export type Columns = BuildExtraConfigColumns<
  'repository_files',
  typeof columns,
  'pg'
>;
