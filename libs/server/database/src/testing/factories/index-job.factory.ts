import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { indexJobs } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type IndexJobInsert = typeof indexJobs.$inferInsert;
export type IndexJobRow = typeof indexJobs.$inferSelect;

/** Pass `repositoryId` when calling `create()`; `build()` uses a random id. */
export const indexJobFactory = Factory.define<
  IndexJobInsert,
  DatabaseTransientParams,
  IndexJobRow
>(({ onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(indexJobs)
      .values(values)
      .returning();
    return row;
  });

  return { repositoryId: faker.string.uuid() };
});
