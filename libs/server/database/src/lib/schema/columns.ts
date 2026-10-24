import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Must match EMBEDDING_DIMENSIONS; changing it requires a new migration and a re-index. */
export const EMBEDDING_DIMENSIONS = 768;

export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const id = () => uuid('id').primaryKey().defaultRandom();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
