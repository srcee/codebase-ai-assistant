import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('code_chunks_repository_idx').on(table.repositoryId),
  index('code_chunks_file_idx').on(table.fileId),
  index('code_chunks_chunk_hash_idx').on(table.chunkHash),
  index('code_chunks_search_vector_idx').using('gin', table.searchVector),
  index('code_chunks_embedding_hnsw_idx').using(
    'hnsw',
    table.embedding.op('vector_cosine_ops'),
  ),
];
