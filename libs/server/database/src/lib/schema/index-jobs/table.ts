import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';
import { constraints } from './constraints';
import { indexes } from './indexes';

export const indexJobs = pgTable('index_jobs', columns, (table) => [
  ...indexes(table),
  ...constraints(table),
]);
