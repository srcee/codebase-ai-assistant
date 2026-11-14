import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  projectId: uuid('project_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  createdAt: createdAt(),
};

export type Columns = BuildExtraConfigColumns<
  'project_sources',
  typeof columns,
  'pg'
>;
