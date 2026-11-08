import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { evalRoot } from './eval-root';

export const QUESTION_CATEGORIES = [
  'identifier',
  'snake-case',
  'error-string',
  'paraphrase',
  'cross-file',
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

const expectedLocation = z.object({
  path: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  /** Text that must appear inside the range, so a stale range is caught when the corpus changes. */
  anchor: z.string().min(1),
});

const questionSet = z.object({
  version: z.number().int().min(1),
  corpus: z.string().min(1),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      category: z.enum(QUESTION_CATEGORIES),
      question: z.string().min(1),
      expected: z.array(expectedLocation).min(1),
    }),
  ),
});

export type ExpectedLocation = z.infer<typeof expectedLocation>;
export type EvalQuestionSet = z.infer<typeof questionSet>;
export type EvalQuestion = EvalQuestionSet['questions'][number];

export const QUESTIONS_FILE = 'questions.v1.json';

export function loadQuestionSet(root = evalRoot()): EvalQuestionSet {
  const raw: unknown = JSON.parse(
    readFileSync(join(root, QUESTIONS_FILE), 'utf8'),
  );
  return questionSet.parse(raw);
}
