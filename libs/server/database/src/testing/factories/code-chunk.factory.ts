import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { codeChunks } from '../../lib/schema';
import { unitVector } from '../vectors';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type CodeChunkInsert = typeof codeChunks.$inferInsert;
export type CodeChunkRow = typeof codeChunks.$inferSelect;

/** Pass `repositoryId` and `fileId` when calling `create()`; `build()` uses random ids. */
export const codeChunkFactory = Factory.define<
  CodeChunkInsert,
  DatabaseTransientParams,
  CodeChunkRow
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(codeChunks)
      .values(values)
      .returning();
    return row;
  });

  const symbolName = `${faker.lorem.word()}${sequence}`;
  const startLine = faker.number.int({ min: 1, max: 100 });
  return {
    repositoryId: faker.string.uuid(),
    fileId: faker.string.uuid(),
    chunkHash: faker.string.hexadecimal({
      length: 64,
      prefix: '',
      casing: 'lower',
    }),
    symbolName,
    startLine,
    endLine: startLine + faker.number.int({ min: 0, max: 50 }),
    content: `export const ${symbolName} = ${faker.number.int({ max: 1000 })};`,
    embedding: unitVector(),
    embeddingModel: `model-${faker.lorem.word()}`,
    chunkingVersion: String(faker.number.int({ min: 1, max: 9 })),
  };
});
