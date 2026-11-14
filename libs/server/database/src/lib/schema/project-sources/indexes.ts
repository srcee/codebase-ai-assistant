import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('project_sources_source_idx').on(table.sourceId),
];
