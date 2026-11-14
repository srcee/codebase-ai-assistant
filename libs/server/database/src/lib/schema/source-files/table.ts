import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';

export const sourceFiles = pgTable('source_files', columns, (table) => [
  ...constraints(table),
]);
