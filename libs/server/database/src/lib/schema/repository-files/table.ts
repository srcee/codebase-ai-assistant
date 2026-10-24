import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';

export const repositoryFiles = pgTable('repository_files', columns, (table) => [
  ...constraints(table),
]);
