import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { bigint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';
import { sources } from '../sources/table';

export const columns = {
  id: id(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  logicalPath: text('logical_path').notNull(),
  blobHash: text('blob_hash').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  mediaType: text('media_type').notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export type Columns = BuildExtraConfigColumns<
  'documents',
  typeof columns,
  'pg'
>;
