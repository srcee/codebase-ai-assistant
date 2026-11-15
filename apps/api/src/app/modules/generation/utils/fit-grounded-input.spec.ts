import { faker } from '@codebase-ai/shared-testing';
import { searchCandidateFactory } from '../../../../testing/factories/search-candidate.factory';
import type { ConversationTurn } from '../types/grounded-answer-input';
import { buildGroundedPrompt } from './build-grounded-prompt';
import {
  CHARS_PER_TOKEN,
  fitGroundedInput,
  type PromptBudget,
} from './fit-grounded-input';

const budget: PromptBudget = {
  contextTokens: 4096,
  maxAnswerTokens: 1024,
  historyTurns: 4,
  historyMaxChars: 100_000,
};

const promptChars = (budget: PromptBudget): number =>
  (budget.contextTokens - budget.maxAnswerTokens) * CHARS_PER_TOKEN;

const turn = (size: number): ConversationTurn => ({
  question: faker.string.alpha(size / 2),
  answer: faker.string.alpha(size / 2),
});

describe('fitGroundedInput', () => {
  it('keeps everything that fits', () => {
    const input = {
      question: faker.lorem.sentence(),
      evidence: searchCandidateFactory.buildList(3),
      history: [turn(100)],
    };

    expect(fitGroundedInput(input, budget)).toEqual(input);
  });

  it('drops the lowest-ranked evidence that does not fit and keeps the order', () => {
    const evidence = searchCandidateFactory.buildList(6, {
      content: faker.string.alpha(2500),
    });

    const fitted = fitGroundedInput(
      { question: faker.lorem.sentence(), evidence, history: [] },
      budget,
    );

    expect(fitted.evidence.length).toBeGreaterThan(0);
    expect(fitted.evidence.length).toBeLessThan(evidence.length);
    expect(fitted.evidence).toEqual(evidence.slice(0, fitted.evidence.length));
  });

  it('gives history only what evidence leaves, newest turns first', () => {
    const evidence = searchCandidateFactory.buildList(2, {
      content: faker.string.alpha(2500),
    });
    const history = [turn(1500), turn(1500), turn(1500)];

    const fitted = fitGroundedInput(
      { question: faker.lorem.sentence(), evidence, history },
      budget,
    );

    expect(fitted.evidence).toEqual(evidence);
    expect(fitted.history.length).toBeLessThan(history.length);
    expect(fitted.history).toEqual(
      history.slice(history.length - fitted.history.length),
    );
  });

  it('never builds a prompt over the budget', () => {
    const input = {
      question: faker.string.alpha(4000),
      evidence: searchCandidateFactory.buildList(10, {
        content: faker.string.alpha(2000),
      }),
      history: [turn(2000), turn(2000)],
    };

    const fitted = fitGroundedInput(input, budget);
    const size = buildGroundedPrompt(fitted, {
      maxTurns: budget.historyTurns,
      maxChars: budget.historyMaxChars,
    }).reduce((total, message) => total + message.content.length, 0);

    expect(size).toBeLessThanOrEqual(promptChars(budget));
  });

  it('keeps no evidence when not even the best block fits', () => {
    const fitted = fitGroundedInput(
      {
        question: faker.lorem.sentence(),
        evidence: searchCandidateFactory.buildList(1, {
          content: faker.string.alpha(promptChars(budget)),
        }),
        history: [],
      },
      budget,
    );

    expect(fitted.evidence).toEqual([]);
  });
});
