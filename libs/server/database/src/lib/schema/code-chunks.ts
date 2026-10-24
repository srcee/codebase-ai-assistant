import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { createdAt, EMBEDDING_DIMENSIONS, id, tsvector } from './columns';
import { repositories } from './repositories';
import { repositoryFiles } from './repository-files';

export const codeChunks = pgTable(
  'code_chunks',
  {
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
    // 'simple' keeps identifiers and error strings intact instead of stemming them.
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(symbol_name, '') || ' ' || content)`,
    ),
    embedding: vector('embedding', {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    embeddingModel: text('embedding_model').notNull(),
    chunkingVersion: text('chunking_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'code_chunks_file_repository_fkey',
      columns: [t.fileId, t.repositoryId],
      foreignColumns: [repositoryFiles.id, repositoryFiles.repositoryId],
    }).onDelete('cascade'),
    check(
      'code_chunks_lines_check',
      sql`${t.startLine} >= 1 and ${t.endLine} >= ${t.startLine}`,
    ),
    index('code_chunks_repository_idx').on(t.repositoryId),
    index('code_chunks_file_idx').on(t.fileId),
    index('code_chunks_chunk_hash_idx').on(t.chunkHash),
    index('code_chunks_search_vector_idx').using('gin', t.searchVector),
    index('code_chunks_embedding_hnsw_idx').using(
      'hnsw',
      t.embedding.op('vector_cosine_ops'),
    ),
  ],
);
