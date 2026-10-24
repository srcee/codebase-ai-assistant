import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns';
import { repositories } from './repositories';

export const indexJobs = pgTable(
  'index_jobs',
  {
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
  },
  (t) => [
    index('index_jobs_repository_idx').on(t.repositoryId),
    check(
      'index_jobs_status_check',
      sql`${t.status} in ('queued', 'running', 'succeeded', 'failed')`,
    ),
  ],
);
