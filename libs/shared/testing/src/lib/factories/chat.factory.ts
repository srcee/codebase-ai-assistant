import { Factory } from 'fishery';
import type {
  ChatDoneEvent,
  Citation,
  ConversationResponse,
  ConversationSummary,
  MessageResponse,
} from '@codebase-ai/contracts';
import { faker } from '../faker';

export const citationFactory = Factory.define<Citation>(({ sequence }) => {
  const startLine = faker.number.int({ min: 1, max: 200 });
  return {
    ordinal: sequence,
    chunkId: faker.string.uuid(),
    sourceId: faker.string.uuid(),
    sourceName: `${faker.word.noun()}-${sequence}`,
    relativePath: `src/${faker.word.noun()}-${sequence}.ts`,
    contentKind: 'code',
    locator: {
      kind: 'lines',
      startLine,
      endLine: startLine + faker.number.int({ min: 0, max: 30 }),
    },
  };
});

export const chatDoneEventFactory = Factory.define<ChatDoneEvent>(() => ({
  messageId: faker.string.uuid(),
  answer: `${faker.lorem.sentence()} [1]`,
  status: 'complete',
  citations: [citationFactory.build({ ordinal: 1 })],
  invalidCitations: [],
  suggestions: [],
}));

export const conversationSummaryFactory = Factory.define<ConversationSummary>(
  ({ sequence }) => {
    const createdAt = faker.date.past();
    return {
      id: faker.string.uuid(),
      title: `${faker.lorem.sentence()} ${sequence}`,
      projectId: null,
      createdAt: createdAt.toISOString(),
      updatedAt: faker.date
        .between({ from: createdAt, to: new Date() })
        .toISOString(),
    };
  },
);

export const messageResponseFactory = Factory.define<MessageResponse>(() => ({
  id: faker.string.uuid(),
  role: 'assistant',
  status: 'complete',
  content: faker.lorem.paragraph(),
  citations: [],
  createdAt: faker.date.recent().toISOString(),
}));

export const conversationResponseFactory = Factory.define<ConversationResponse>(
  () => ({
    ...conversationSummaryFactory.build(),
    messages: {
      items: [
        messageResponseFactory.build({ role: 'user' }),
        messageResponseFactory.build({ citations: [citationFactory.build()] }),
      ],
      nextCursor: null,
    },
  }),
);
