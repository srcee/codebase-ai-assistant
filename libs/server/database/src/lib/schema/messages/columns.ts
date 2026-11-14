import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  conversationId: uuid('conversation_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('complete'),
  content: text('content').notNull(),
  createdAt: createdAt(),
};

export type Columns = BuildExtraConfigColumns<'messages', typeof columns, 'pg'>;
