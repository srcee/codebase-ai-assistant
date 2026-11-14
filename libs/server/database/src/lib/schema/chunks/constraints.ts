import { sql } from 'drizzle-orm';
import { check, foreignKey } from 'drizzle-orm/pg-core';
import { sourceFiles } from '../source-files/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'chunks_file_source_fkey',
    columns: [table.fileId, table.sourceId],
    foreignColumns: [sourceFiles.id, sourceFiles.sourceId],
  }).onDelete('cascade'),
  check(
    'chunks_lines_check',
    sql`(${table.startLine} is null and ${table.endLine} is null) or (${table.startLine} is not null and ${table.endLine} is not null and ${table.startLine} >= 1 and ${table.endLine} >= ${table.startLine})`,
  ),
  check(
    'chunks_content_kind_check',
    sql`${table.contentKind} in ('code', 'prose', 'table_rows', 'schema_entity', 'image_description')`,
  ),
  check(
    'chunks_locator_kind_check',
    sql`${table.locator}->>'kind' is not null and ${table.locator}->>'kind' in ('lines', 'section', 'page', 'table_rows', 'schema_entity', 'image')`,
  ),
];
