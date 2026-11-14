import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import type { ChatAnswerScore, ChatSummary } from '../evaluation/chat-metrics';
import type { ChatEvalReport } from '../evaluation/chat-report';
import { evalReportFactory } from './eval.factory';

export const chatAnswerScoreFactory = Factory.define<ChatAnswerScore>(
  ({ sequence }) => ({
    id: `question-${sequence}`,
    answerable: true,
    abstained: false,
    declined: false,
    validCitations: faker.number.int({ min: 0, max: 3 }),
    invalidCitations: 0,
    citedExpected: true,
    latencyMs: faker.number.int({ min: 100, max: 5000 }),
    answer: faker.lorem.sentence(),
  }),
);

const chatSummaryFactory = Factory.define<ChatSummary>(() => ({
  answerable: faker.number.int({ min: 10, max: 40 }),
  unanswerable: faker.number.int({ min: 5, max: 10 }),
  citationValidity: faker.number.float({ min: 0, max: 1 }),
  answeredWithCitation: faker.number.float({ min: 0, max: 1 }),
  expectedCited: faker.number.float({ min: 0, max: 1 }),
  abstentionRecall: faker.number.float({ min: 0, max: 1 }),
  serverAbstentionRecall: faker.number.float({ min: 0, max: 1 }),
  falseAbstention: faker.number.float({ min: 0, max: 1 }),
  latencyP50Ms: faker.number.int({ min: 100, max: 2000 }),
  latencyP95Ms: faker.number.int({ min: 2000, max: 9000 }),
}));

export const chatEvalReportFactory = Factory.define<ChatEvalReport>(() => {
  const base = evalReportFactory.build();
  return {
    label: base.label,
    generatedAt: base.generatedAt,
    questionSetVersion: 1,
    chatModel: faker.word.noun(),
    config: {
      ...base.config,
      minVectorSimilarity: 0.5,
      maxChunks: 8,
      maxContextChars: 12000,
    },
    summary: chatSummaryFactory.build(),
    answers: chatAnswerScoreFactory.buildList(2),
  };
});
