import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';

export const repositories = pgTable('repositories', columns, (table) => [
  ...constraints(table),
]);
