import { sql } from 'drizzle-orm';
import { index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('index_jobs_source_idx').on(table.sourceId),
  uniqueIndex('index_jobs_one_active_per_source_key')
    .on(table.sourceId)
    .where(sql`${table.status} in ('queued', 'running')`),
];
