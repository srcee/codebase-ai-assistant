import { sql } from 'drizzle-orm';
import { index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('index_jobs_repository_idx').on(table.repositoryId),
  uniqueIndex('index_jobs_one_active_per_repository_key')
    .on(table.repositoryId)
    .where(sql`${table.status} in ('queued', 'running')`),
];
