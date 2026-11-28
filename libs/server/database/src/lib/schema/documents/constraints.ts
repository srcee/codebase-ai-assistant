import { sql } from 'drizzle-orm';
import { check } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  check('documents_size_check', sql`${table.sizeBytes} >= 0`),
  check('documents_blob_hash_check', sql`${table.blobHash} ~ '^[0-9a-f]{64}$'`),
];
