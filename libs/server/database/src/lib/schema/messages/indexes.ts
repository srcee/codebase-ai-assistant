import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('messages_conversation_created_at_id_idx').on(
    table.conversationId,
    table.createdAt,
    table.id,
  ),
];
