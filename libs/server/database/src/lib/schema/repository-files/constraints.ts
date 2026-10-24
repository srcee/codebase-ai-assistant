import { sql } from 'drizzle-orm';
import { check, unique } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  unique('repository_files_repository_path_key').on(
    table.repositoryId,
    table.relativePath,
  ),
  // Lets chunks reference (file, repository) so a chunk cannot point at another repository's file.
  unique('repository_files_id_repository_key').on(table.id, table.repositoryId),
  check('repository_files_size_check', sql`${table.sizeBytes} >= 0`),
  check(
    'repository_files_status_check',
    sql`${table.status} in ('indexed', 'skipped', 'failed')`,
  ),
];
