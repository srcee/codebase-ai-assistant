import { sql } from 'drizzle-orm';
import { check } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  check(
    'sources_kind_check',
    sql`${table.kind} in ('code_repository', 'document_collection')`,
  ),
  check('sources_origin_check', sql`${table.origin} in ('folder', 'upload')`),
  check(
    'sources_document_collection_origin_check',
    sql`${table.kind} <> 'document_collection' or ${table.origin} is not null`,
  ),
  // Upload collections live in the blob store; every other source is a folder on disk.
  check(
    'sources_canonical_path_check',
    sql`(${table.origin} is not distinct from 'upload') = (${table.canonicalPath} is null)`,
  ),
  check('sources_privacy_mode_check', sql`${table.privacyMode} in ('local')`),
  check(
    'sources_status_check',
    sql`${table.status} in ('registered', 'indexing', 'ready', 'failed')`,
  ),
];
