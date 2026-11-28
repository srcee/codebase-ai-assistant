import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { documents } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type DocumentInsert = typeof documents.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;

/** Pass `sourceId` of an upload collection when calling `create()`. */
export const documentFactory = Factory.define<
  DocumentInsert,
  DatabaseTransientParams,
  DocumentRow
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(documents)
      .values(values)
      .returning();
    return row;
  });

  return {
    sourceId: faker.string.uuid(),
    logicalPath: `specs/${faker.word.noun()}-${sequence}.md`,
    blobHash: faker.string.hexadecimal({
      length: 64,
      prefix: '',
      casing: 'lower',
    }),
    sizeBytes: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'text/markdown',
  };
});
