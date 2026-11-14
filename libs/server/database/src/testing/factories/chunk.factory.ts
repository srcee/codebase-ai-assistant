import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { chunks } from '../../lib/schema';
import { unitVector } from '../vectors';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type ChunkInsert = typeof chunks.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;

/** Builds a code chunk; pass `sourceId` and `fileId` when calling `create()`, `build()` uses random ids. */
export const chunkFactory = Factory.define<
  ChunkInsert,
  DatabaseTransientParams,
  ChunkRow
>(({ sequence, params, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(chunks)
      .values(values)
      .returning();
    return row;
  });

  const title = `${faker.lorem.word()}${sequence}`;
  const startLine = faker.number.int({ min: 1, max: 100 });
  const endLine = startLine + faker.number.int({ min: 0, max: 50 });
  return {
    sourceId: faker.string.uuid(),
    fileId: faker.string.uuid(),
    chunkHash: faker.string.hexadecimal({
      length: 64,
      prefix: '',
      casing: 'lower',
    }),
    title,
    contentKind: 'code',
    // fishery deep-merges params, so a given locator must replace the default instead of being merged into it.
    locator: (params.locator as ChunkInsert['locator'] | undefined) ?? {
      kind: 'lines',
      startLine,
      endLine,
    },
    startLine,
    endLine,
    content: `export const ${title} = ${faker.number.int({ max: 1000 })};`,
    embedding: unitVector(),
    embeddingModel: `model-${faker.lorem.word()}`,
    chunkingVersion: String(faker.number.int({ min: 1, max: 9 })),
  };
});
