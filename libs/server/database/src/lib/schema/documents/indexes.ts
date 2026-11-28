import { sql } from 'drizzle-orm';
import { index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  // Windows paths ignore case, so Specs/Roles.md and specs/roles.md are one document.
  uniqueIndex('documents_source_path_key').on(
    table.sourceId,
    sql`lower(${table.logicalPath})`,
  ),
  index('documents_blob_hash_idx').on(table.blobHash),
];
