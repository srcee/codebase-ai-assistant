import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { conversations } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type ConversationInsert = typeof conversations.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;

export const conversationFactory = Factory.define<
  ConversationInsert,
  DatabaseTransientParams,
  ConversationRow
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(conversations)
      .values(values)
      .returning();
    return row;
  });

  const createdAt = faker.date.past();
  return {
    projectId: null,
    title: `${faker.lorem.sentence()} ${sequence}`,
    createdAt,
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
  };
});
