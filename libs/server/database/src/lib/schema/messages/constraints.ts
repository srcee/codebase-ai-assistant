import { sql } from 'drizzle-orm';
import { check, foreignKey } from 'drizzle-orm/pg-core';
import { conversations } from '../conversations/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'messages_conversation_id_conversations_id_fk',
    columns: [table.conversationId],
    foreignColumns: [conversations.id],
  }).onDelete('cascade'),
  check('messages_role_check', sql`${table.role} in ('user', 'assistant')`),
  check(
    'messages_status_check',
    sql`${table.status} in ('complete', 'abstained')`,
  ),
];
