import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { messageCitations } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type MessageCitationInsert = typeof messageCitations.$inferInsert;
export type MessageCitationRow = typeof messageCitations.$inferSelect;

/** Pass `messageId` (and `chunkId` to link a chunk) when calling `create()`. */
export const messageCitationFactory = Factory.define<
  MessageCitationInsert,
  DatabaseTransientParams,
  MessageCitationRow
>(({ sequence, params, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(messageCitations)
      .values(values)
      .returning();
    return row;
  });

  const startLine = faker.number.int({ min: 1, max: 100 });
  return {
    messageId: faker.string.uuid(),
    ordinal: sequence,
    chunkId: null,
    sourceId: faker.string.uuid(),
    sourceName: faker.word.noun(),
    relativePath: faker.system.filePath().replace(/^\//, ''),
    contentKind: 'code',
    locator: (params.locator as
      | MessageCitationInsert['locator']
      | undefined) ?? {
      kind: 'lines',
      startLine,
      endLine: startLine + faker.number.int({ min: 0, max: 50 }),
    },
  };
});
