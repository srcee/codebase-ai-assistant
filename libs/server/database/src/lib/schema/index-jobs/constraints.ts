import { sql } from 'drizzle-orm';
import { check } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  check(
    'index_jobs_status_check',
    sql`${table.status} in ('queued', 'running', 'succeeded', 'failed')`,
  ),
];
