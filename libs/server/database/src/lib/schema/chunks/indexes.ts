import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('chunks_source_idx').on(table.sourceId),
  index('chunks_file_idx').on(table.fileId),
  index('chunks_chunk_hash_idx').on(table.chunkHash),
  index('chunks_search_vector_idx').using('gin', table.searchVector),
  index('chunks_embedding_hnsw_idx').using(
    'hnsw',
    table.embedding.op('vector_cosine_ops'),
  ),
];
