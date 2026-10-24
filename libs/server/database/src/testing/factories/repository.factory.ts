import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { repositories } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type RepositoryRow = typeof repositories.$inferSelect;

/** Builds a complete row, so `build()` can feed code that reads stored rows. */
export const repositoryFactory = Factory.define<
  RepositoryRow,
  DatabaseTransientParams
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(repositories)
      .values(values)
      .returning();
    return row;
  });

  const name = `${faker.word.noun()}-${sequence}`;
  const createdAt = faker.date.past();
  return {
    id: faker.string.uuid(),
    name,
    canonicalPath: `/synthetic/${name}`,
    privacyMode: 'local',
    status: 'registered',
    lastIndexedCommit: null,
    createdAt,
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
  };
});
