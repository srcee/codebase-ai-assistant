import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { messages } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type MessageInsert = typeof messages.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;

/** Pass `conversationId` when calling `create()`. */
export const messageFactory = Factory.define<
  MessageInsert,
  DatabaseTransientParams,
  MessageRow
>(({ onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(messages)
      .values(values)
      .returning();
    return row;
  });

  return {
    conversationId: faker.string.uuid(),
    role: faker.helpers.arrayElement(['user', 'assistant']),
    status: 'complete',
    content: faker.lorem.paragraph(),
  };
});
