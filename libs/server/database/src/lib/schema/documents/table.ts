import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';
import { indexes } from './indexes';

export const documents = pgTable('documents', columns, (table) => [
  ...constraints(table),
  ...indexes(table),
]);
