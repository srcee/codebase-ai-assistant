import { type BuildExtraConfigColumns, sql } from 'drizzle-orm';
import { integer, text, uuid, vector } from 'drizzle-orm/pg-core';
import { repositories } from '../repositories/table';
import {
  createdAt,
  EMBEDDING_DIMENSIONS,
  id,
  tsvector,
} from '../shared/columns';

// 'simple' keeps identifiers and error strings intact instead of stemming them.
const searchText = sql`to_tsvector('simple', coalesce(symbol_name, '') || ' ' || content)`;

export const columns = {
  id: id(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').notNull(),

  chunkHash: text('chunk_hash').notNull(),
  symbolName: text('symbol_name'),
  startLine: integer('start_line').notNull(),
  endLine: integer('end_line').notNull(),
  content: text('content').notNull(),

  searchVector: tsvector('search_vector').generatedAlwaysAs(searchText),
  embedding: vector('embedding', {
    dimensions: EMBEDDING_DIMENSIONS,
  }).notNull(),
  embeddingModel: text('embedding_model').notNull(),
  chunkingVersion: text('chunking_version').notNull(),

  createdAt: createdAt(),
};

export type Columns = BuildExtraConfigColumns<
  'code_chunks',
  typeof columns,
  'pg'
>;
