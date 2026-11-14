import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { sourceFiles } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type SourceFileInsert = typeof sourceFiles.$inferInsert;
export type SourceFileRow = typeof sourceFiles.$inferSelect;

/** Pass `sourceId` when calling `create()`; `build()` uses a random id. */
export const sourceFileFactory = Factory.define<
  SourceFileInsert,
  DatabaseTransientParams,
  SourceFileRow
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(sourceFiles)
      .values(values)
      .returning();
    return row;
  });

  return {
    sourceId: faker.string.uuid(),
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
