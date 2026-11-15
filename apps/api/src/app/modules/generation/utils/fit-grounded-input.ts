import { GROUNDED_SYSTEM_PROMPT } from '../constants/grounded-system-prompt';
import type { EvidenceItem } from '../types/evidence-item';
import type { GroundedAnswerInput } from '../types/grounded-answer-input';
import { evidenceBlock, trimHistory } from './build-grounded-prompt';

// No tokenizer for the local model, so assume dense text such as code.
export const CHARS_PER_TOKEN = 3;
// Chat template markers per message and the boundary header line.
const OVERHEAD_TOKENS = 128;
const SAMPLE_TOKEN = '00000000-0000-0000-0000-000000000000';

export interface PromptBudget {
  contextTokens: number;
  maxAnswerTokens: number;
  historyTurns: number;
  historyMaxChars: number;
}

/** Keeps the best-ranked evidence that fits the context window, then gives history what is left. */
export function fitGroundedInput<T extends EvidenceItem>(
  input: GroundedAnswerInput<T>,
  budget: PromptBudget,
): GroundedAnswerInput<T> {
  let remaining =
    (budget.contextTokens - budget.maxAnswerTokens - OVERHEAD_TOKENS) *
      CHARS_PER_TOKEN -
    GROUNDED_SYSTEM_PROMPT.length -
    input.question.length;

  const evidence: T[] = [];
  for (const item of input.evidence) {
    const size = evidenceBlock(item, evidence.length, SAMPLE_TOKEN).length + 2;
    if (size > remaining) break;
    evidence.push(item);
    remaining -= size;
  }

  const history = trimHistory(input.history, {
    maxTurns: budget.historyTurns,
    maxChars: Math.max(0, Math.min(budget.historyMaxChars, remaining)),
  });
  return { question: input.question, evidence, history };
}
