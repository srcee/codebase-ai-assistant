import type { ChatDoneEvent } from '@codebase-ai/contracts';
import type { ExpectedLocation } from './eval-questions';
import { isHit, percentile } from './metrics';

// The model may decline in its own words instead of the server abstaining.
const DECLINED =
  /\b(not enough (evidence|information|to answer)|insufficient|does not (contain|answer|mention|show)|cannot (answer|find|determine)|no (relevant )?(evidence|information))\b/i;

export interface ChatAnswerScore {
  id: string;
  answerable: boolean;
  /** The server returned its fixed abstention without calling the model. */
  abstained: boolean;
  declined: boolean;
  validCitations: number;
  invalidCitations: number;
  /** Answerable only: a valid citation overlaps an expected location. */
  citedExpected: boolean;
  latencyMs: number;
  answer: string;
}

export interface ChatSummary {
  answerable: number;
  unanswerable: number;
  /** Valid share of every citation number the model wrote. */
  citationValidity: number;
  /** Answerable questions answered (not abstained or declined) with at least one valid citation. */
  answeredWithCitation: number;
  /** Answerable questions where a valid citation points at an expected location; a groundedness proxy. */
  expectedCited: number;
  /** Unanswerable questions that abstained or declined. */
  abstentionRecall: number;
  /** Unanswerable questions the server abstained on without calling the model. */
  serverAbstentionRecall: number;
  /** Answerable questions that abstained or declined. */
  falseAbstention: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export function scoreChatAnswer(
  question: {
    id: string;
    expected?: readonly Pick<
      ExpectedLocation,
      'path' | 'startLine' | 'endLine'
    >[];
  },
  done: ChatDoneEvent,
  latencyMs: number,
): ChatAnswerScore {
  const abstained = done.status === 'abstained';
  return {
    id: question.id,
    answerable: question.expected !== undefined,
    abstained,
    declined: !abstained && DECLINED.test(done.answer),
    validCitations: done.citations.length,
    invalidCitations: done.invalidCitations.length,
    citedExpected: (question.expected ?? []).some((expected) =>
      done.citations.some((citation) => isHit(citation, expected)),
    ),
    latencyMs,
    answer: done.answer,
  };
}

const share = (count: number, total: number): number =>
  total === 0 ? 0 : count / total;

export function summarizeChat(scores: readonly ChatAnswerScore[]): ChatSummary {
  const answerable = scores.filter((score) => score.answerable);
  const unanswerable = scores.filter((score) => !score.answerable);
  const refused = (score: ChatAnswerScore) => score.abstained || score.declined;
  const valid = scores.reduce((sum, score) => sum + score.validCitations, 0);
  const invalid = scores.reduce(
    (sum, score) => sum + score.invalidCitations,
    0,
  );
  const latencies = scores.map((score) => score.latencyMs);
  return {
    answerable: answerable.length,
    unanswerable: unanswerable.length,
    citationValidity: valid + invalid === 0 ? 1 : valid / (valid + invalid),
    answeredWithCitation: share(
      answerable.filter((score) => !refused(score) && score.validCitations > 0)
        .length,
      answerable.length,
    ),
    expectedCited: share(
      answerable.filter((score) => score.citedExpected).length,
      answerable.length,
    ),
    abstentionRecall: share(
      unanswerable.filter(refused).length,
      unanswerable.length,
    ),
    serverAbstentionRecall: share(
      unanswerable.filter((score) => score.abstained).length,
      unanswerable.length,
    ),
    falseAbstention: share(
      answerable.filter(refused).length,
      answerable.length,
    ),
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
  };
}
