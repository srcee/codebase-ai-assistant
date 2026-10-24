import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('index_jobs_repository_idx').on(table.repositoryId),
];
