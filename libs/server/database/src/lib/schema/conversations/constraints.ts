import { foreignKey } from 'drizzle-orm/pg-core';
import { projects } from '../projects/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'conversations_project_id_projects_id_fk',
    columns: [table.projectId],
    foreignColumns: [projects.id],
  }).onDelete('set null'),
];
