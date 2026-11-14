import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { evalRoot } from './eval-root';

const chatQuestionSet = z.object({
  version: z.number().int().min(1),
  corpus: z.string().min(1),
  answerableQuestionSet: z.string().min(1),
  unanswerable: z
    .array(z.object({ id: z.string().min(1), question: z.string().min(1) }))
    .min(1),
});

export type ChatQuestionSet = z.infer<typeof chatQuestionSet>;

export const CHAT_QUESTIONS_FILE = 'chat-questions.v1.json';

/** Answerable questions come from the retrieval set; this file adds questions the corpus cannot answer. */
export function loadChatQuestionSet(root = evalRoot()): ChatQuestionSet {
  const raw: unknown = JSON.parse(
    readFileSync(join(root, CHAT_QUESTIONS_FILE), 'utf8'),
  );
  return chatQuestionSet.parse(raw);
}
