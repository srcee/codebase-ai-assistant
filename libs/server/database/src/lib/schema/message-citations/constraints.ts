import { sql } from 'drizzle-orm';
import { check, foreignKey, unique } from 'drizzle-orm/pg-core';
import { chunks } from '../chunks/table';
import { messages } from '../messages/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'message_citations_message_id_messages_id_fk',
    columns: [table.messageId],
    foreignColumns: [messages.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'message_citations_chunk_id_chunks_id_fk',
    columns: [table.chunkId],
    foreignColumns: [chunks.id],
  }).onDelete('set null'),
  unique('message_citations_message_ordinal_key').on(
    table.messageId,
    table.ordinal,
  ),
  check('message_citations_ordinal_check', sql`${table.ordinal} >= 1`),
  check(
    'message_citations_content_kind_check',
    sql`${table.contentKind} in ('code', 'prose', 'table_rows', 'schema_entity', 'image_description')`,
  ),
];
