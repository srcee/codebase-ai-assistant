import {
  chatDoneEventFactory,
  citationFactory,
} from '@codebase-ai/shared-testing';
import { chatAnswerScoreFactory } from '../factories/chat-eval.factory';
import { expectedLocationFactory } from '../factories/eval.factory';
import { scoreChatAnswer, summarizeChat } from './chat-metrics';

describe('scoreChatAnswer', () => {
  it('marks an answerable question whose citation overlaps an expected location', () => {
    const expected = expectedLocationFactory.build();
    const done = chatDoneEventFactory.build({
      citations: [
        citationFactory.build({
          relativePath: expected.path,
          locator: {
            kind: 'lines',
            startLine: expected.startLine,
            endLine: expected.startLine,
          },
        }),
      ],
      invalidCitations: [5],
    });

    expect(
      scoreChatAnswer({ id: 'q', expected: [expected] }, done, 42),
    ).toMatchObject({
      id: 'q',
      answerable: true,
      abstained: false,
      validCitations: 1,
      invalidCitations: 1,
      citedExpected: true,
      latencyMs: 42,
    });
  });

  it('separates server abstention from a model that declines', () => {
    const abstained = chatDoneEventFactory.build({
      status: 'abstained',
      citations: [],
    });
    const declined = chatDoneEventFactory.build({
      answer: 'The provided evidence is not enough to answer this.',
      citations: [],
    });

    expect(scoreChatAnswer({ id: 'a' }, abstained, 1)).toMatchObject({
      answerable: false,
      abstained: true,
      declined: false,
      citedExpected: false,
    });
    expect(scoreChatAnswer({ id: 'b' }, declined, 1)).toMatchObject({
      abstained: false,
      declined: true,
    });
  });
});

describe('summarizeChat', () => {
  it('computes citation validity, grounding proxy, and abstention rates', () => {
    const summary = summarizeChat([
      chatAnswerScoreFactory.build({
        validCitations: 3,
        invalidCitations: 1,
        citedExpected: true,
      }),
      chatAnswerScoreFactory.build({
        validCitations: 0,
        declined: true,
        citedExpected: false,
      }),
      chatAnswerScoreFactory.build({
        answerable: false,
        abstained: true,
        validCitations: 0,
        citedExpected: false,
      }),
      chatAnswerScoreFactory.build({
        answerable: false,
        validCitations: 0,
        citedExpected: false,
      }),
    ]);

    expect(summary).toMatchObject({
      answerable: 2,
      unanswerable: 2,
      citationValidity: 0.75,
      answeredWithCitation: 0.5,
      expectedCited: 0.5,
      abstentionRecall: 0.5,
      serverAbstentionRecall: 0.5,
      falseAbstention: 0.5,
    });
  });

  it('treats a run without citations as fully valid and empty groups as zero', () => {
    expect(summarizeChat([])).toMatchObject({
      citationValidity: 1,
      expectedCited: 0,
      abstentionRecall: 0,
      latencyP50Ms: 0,
    });
  });
});
