import { index } from 'drizzle-orm/pg-core';
import type { Columns } from './columns';

export const indexes = (table: Columns) => [
  index('conversations_updated_at_id_idx').on(table.updatedAt, table.id),
  index('conversations_project_idx').on(table.projectId),
];
