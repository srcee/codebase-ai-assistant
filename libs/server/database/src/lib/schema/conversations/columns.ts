import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  projectId: uuid('project_id'),
  title: text('title').notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export type Columns = BuildExtraConfigColumns<
  'conversations',
  typeof columns,
  'pg'
>;
