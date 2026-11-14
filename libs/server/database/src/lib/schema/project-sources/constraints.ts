import { foreignKey, unique } from 'drizzle-orm/pg-core';
import { projects } from '../projects/table';
import { sources } from '../sources/table';
import type { Columns } from './columns';

export const constraints = (table: Columns) => [
  foreignKey({
    name: 'project_sources_project_id_projects_id_fk',
    columns: [table.projectId],
    foreignColumns: [projects.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'project_sources_source_id_sources_id_fk',
    columns: [table.sourceId],
    foreignColumns: [sources.id],
  }).onDelete('cascade'),
  unique('project_sources_project_source_key').on(
    table.projectId,
    table.sourceId,
  ),
];
