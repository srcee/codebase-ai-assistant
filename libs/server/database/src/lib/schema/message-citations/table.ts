import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';
import { indexes } from './indexes';

export const messageCitations = pgTable(
  'message_citations',
  columns,
  (table) => [...constraints(table), ...indexes(table)],
);
