import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { repositories } from '../repositories/table';
import { createdAt, id } from '../shared/columns';

export const columns = {
  id: id(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  filesDiscovered: integer('files_discovered').notNull().default(0),
  filesIndexed: integer('files_indexed').notNull().default(0),
  filesSkipped: integer('files_skipped').notNull().default(0),
  filesFailed: integer('files_failed').notNull().default(0),
  chunksWritten: integer('chunks_written').notNull().default(0),
  errorSummary: text('error_summary'),
  createdAt: createdAt(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
};

export type Columns = BuildExtraConfigColumns<
  'index_jobs',
  typeof columns,
  'pg'
>;
