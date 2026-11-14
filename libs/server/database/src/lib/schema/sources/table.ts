import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';

export const sources = pgTable('sources', columns, (table) => [
  ...constraints(table),
]);
