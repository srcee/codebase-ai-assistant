import type { HasDefault, IsPrimaryKey, NotNull } from 'drizzle-orm';
import {
  customType,
  type PgTimestampBuilderInitial,
  type PgUUIDBuilderInitial,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Must match EMBEDDING_DIMENSIONS; changing it requires a new migration and a re-index. */
export const EMBEDDING_DIMENSIONS = 768;

export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const id = (): HasDefault<
  IsPrimaryKey<NotNull<PgUUIDBuilderInitial<'id'>>>
> => uuid('id').primaryKey().defaultRandom();

export const createdAt = (): HasDefault<
  NotNull<PgTimestampBuilderInitial<'created_at'>>
> => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
