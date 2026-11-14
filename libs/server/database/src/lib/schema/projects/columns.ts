import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export type Columns = BuildExtraConfigColumns<'projects', typeof columns, 'pg'>;
