import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';
import { indexes } from './indexes';

export const codeChunks = pgTable('code_chunks', columns, (table) => [
  ...constraints(table),
  ...indexes(table),
]);
