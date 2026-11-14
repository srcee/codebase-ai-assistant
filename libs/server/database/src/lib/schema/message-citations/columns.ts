import type { Locator } from '@codebase-ai/contracts';
import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { integer, jsonb, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  messageId: uuid('message_id').notNull(),
  ordinal: integer('ordinal').notNull(),
  // Null once re-indexing removes the chunk; the copied fields keep the citation readable.
  chunkId: uuid('chunk_id'),
  sourceId: uuid('source_id').notNull(),
  sourceName: text('source_name').notNull(),
  relativePath: text('relative_path').notNull(),
  contentKind: text('content_kind').notNull(),
  locator: jsonb('locator').$type<Locator>().notNull(),
  createdAt: createdAt(),
};

export type Columns = BuildExtraConfigColumns<
  'message_citations',
  typeof columns,
  'pg'
>;
