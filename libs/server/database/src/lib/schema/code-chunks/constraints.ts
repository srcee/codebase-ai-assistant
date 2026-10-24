import { sql } from 'drizzle-orm';
import { check, foreignKey } from 'drizzle-orm/pg-core';
import { repositoryFiles } from '../repository-files/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'code_chunks_file_repository_fkey',
    columns: [table.fileId, table.repositoryId],
    foreignColumns: [repositoryFiles.id, repositoryFiles.repositoryId],
  }).onDelete('cascade'),
  check(
    'code_chunks_lines_check',
    sql`${table.startLine} >= 1 and ${table.endLine} >= ${table.startLine}`,
  ),
];
