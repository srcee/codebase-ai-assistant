import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';
import { indexes } from './indexes';

export const messages = pgTable('messages', columns, (table) => [
  ...constraints(table),
  ...indexes(table),
]);
