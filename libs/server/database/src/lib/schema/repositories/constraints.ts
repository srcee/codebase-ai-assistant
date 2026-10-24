import { sql } from 'drizzle-orm';
import { check } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  check(
    'repositories_privacy_mode_check',
    sql`${table.privacyMode} in ('local')`,
  ),
  check(
    'repositories_status_check',
    sql`${table.status} in ('registered', 'indexing', 'ready', 'failed')`,
  ),
];
