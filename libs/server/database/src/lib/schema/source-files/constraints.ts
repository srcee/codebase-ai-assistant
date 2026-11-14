import { sql } from 'drizzle-orm';
import { check, unique } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  unique('source_files_source_path_key').on(table.sourceId, table.relativePath),
  // Lets chunks reference (file, source) so a chunk cannot point at another source's file.
  unique('source_files_id_source_key').on(table.id, table.sourceId),
  check('source_files_size_check', sql`${table.sizeBytes} >= 0`),
  check(
    'source_files_status_check',
    sql`${table.status} in ('indexed', 'skipped', 'failed')`,
  ),
  check(
    'source_files_content_hash_check',
    sql`${table.status} = 'skipped' or ${table.contentHash} is not null`,
  ),
];
