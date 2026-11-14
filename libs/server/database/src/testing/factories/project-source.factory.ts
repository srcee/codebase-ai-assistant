import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { projectSources } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type ProjectSourceInsert = typeof projectSources.$inferInsert;
export type ProjectSourceRow = typeof projectSources.$inferSelect;

/** Pass `projectId` and `sourceId` when calling `create()`; `build()` uses random ids. */
export const projectSourceFactory = Factory.define<
  ProjectSourceInsert,
  DatabaseTransientParams,
  ProjectSourceRow
>(({ onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(projectSources)
      .values(values)
      .returning();
    return row;
  });

  return {
    projectId: faker.string.uuid(),
    sourceId: faker.string.uuid(),
  };
});
