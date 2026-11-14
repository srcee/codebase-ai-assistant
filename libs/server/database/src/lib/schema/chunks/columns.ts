import type { Locator } from '@codebase-ai/contracts';
import { type BuildExtraConfigColumns, sql } from 'drizzle-orm';
import { integer, jsonb, text, uuid, vector } from 'drizzle-orm/pg-core';
import {
  createdAt,
  EMBEDDING_DIMENSIONS,
  id,
  tsvector,
} from '../shared/columns';
import { sources } from '../sources/table';

// 'simple' keeps identifiers and error strings intact instead of stemming them.
// search_terms holds the words of the chunk and the parts of camelCase words, because the parser keeps dotted text as one lexeme; the title ranks highest.
const searchText = sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || to_tsvector('simple', content) || setweight(to_tsvector('simple', search_terms), 'C')`;

export const columns = {
  id: id(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').notNull(),

  chunkHash: text('chunk_hash').notNull(),
  title: text('title'),
  contentKind: text('content_kind').notNull(),
  locator: jsonb('locator').$type<Locator>().notNull(),
  startLine: integer('start_line'),
  endLine: integer('end_line'),
  content: text('content').notNull(),
  searchTerms: text('search_terms').notNull().default(''),

  searchVector: tsvector('search_vector').generatedAlwaysAs(searchText),
  embedding: vector('embedding', {
    dimensions: EMBEDDING_DIMENSIONS,
  }).notNull(),
  embeddingModel: text('embedding_model').notNull(),
  chunkingVersion: text('chunking_version').notNull(),

  createdAt: createdAt(),
};

export type Columns = BuildExtraConfigColumns<'chunks', typeof columns, 'pg'>;
