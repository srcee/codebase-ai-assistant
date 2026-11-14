import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('message_citations_chunk_idx').on(table.chunkId),
];
