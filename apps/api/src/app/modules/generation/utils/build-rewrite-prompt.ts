import { randomUUID } from 'node:crypto';
import type { ChatMessage } from '../../inference/types/chat-message';
import { FOLLOW_UP_REWRITE_PROMPT } from '../constants/follow-up-rewrite-prompt';
import type { FollowUpInput } from '../types/grounded-answer-input';
import { filterCitationNumbers } from './citation-markers';

// Enough of an answer to resolve "it" or "the second one"; answers can quote whole files.
export const REWRITE_ANSWER_MAX_CHARS = 600;

const shortened = (answer: string): string => {
  const text = filterCitationNumbers(answer, () => false).trim();
  return text.length > REWRITE_ANSWER_MAX_CHARS
    ? `${text.slice(0, REWRITE_ANSWER_MAX_CHARS)}…`
    : text;
};

/** History goes in a block delimited by a per-request token, since answers can quote evidence. */
export function buildRewritePrompt(
  input: FollowUpInput,
  token: string = randomUUID(),
): ChatMessage[] {
  const turns = input.history.flatMap((turn) => [
    `User: ${turn.question}`,
    `Assistant: ${shortened(turn.answer)}`,
  ]);
  return [
    { role: 'system', content: FOLLOW_UP_REWRITE_PROMPT },
    {
      role: 'user',
      content: [
        `Conversation boundary token: ${token}`,
        '',
        `<<<CONVERSATION id=${token}>>>`,
        ...turns,
        `<<<END CONVERSATION id=${token}>>>`,
        '',
        'Latest question:',
        input.question,
      ].join('\n'),
    },
  ];
}
