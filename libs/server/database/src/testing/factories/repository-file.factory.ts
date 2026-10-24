import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { repositoryFiles } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type RepositoryFileInsert = typeof repositoryFiles.$inferInsert;
export type RepositoryFileRow = typeof repositoryFiles.$inferSelect;

/** Pass `repositoryId` when calling `create()`; `build()` uses a random id. */
export const repositoryFileFactory = Factory.define<
  RepositoryFileInsert,
  DatabaseTransientParams,
  RepositoryFileRow
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(repositoryFiles)
      .values(values)
      .returning();
    return row;
  });

  return {
    repositoryId: faker.string.uuid(),
    relativePath: `src/${faker.word.noun()}-${sequence}.ts`,
    contentHash: faker.string.hexadecimal({
      length: 64,
      prefix: '',
      casing: 'lower',
    }),
    language: 'typescript',
    sizeBytes: faker.number.int({ min: 1, max: 100_000 }),
    status: 'indexed',
  };
});
