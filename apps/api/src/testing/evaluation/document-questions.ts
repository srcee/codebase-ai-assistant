import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { locatorSchema } from '../../app/modules/retrieval/utils/locator-schema';
import { evalRoot } from './eval-root';

export const DOCUMENT_QUESTION_CATEGORIES = [
  'role-permission',
  'table-row',
  'workflow',
  'glossary',
  'exact-term',
  'paraphrase',
] as const;

const documentExpectation = z.object({
  /** Relative to the corpus folder. */
  path: z.string().min(1),
  locator: locatorSchema,
  /** Text the expected chunk must contain, so a stale locator is caught when the corpus changes. */
  anchor: z.string().min(1),
});

const documentQuestionSet = z.object({
  version: z.number().int().min(1),
  corpus: z.string().min(1),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      category: z.enum(DOCUMENT_QUESTION_CATEGORIES),
      question: z.string().min(1),
      expected: z.array(documentExpectation).min(1),
    }),
  ),
});

export type DocumentQuestionSet = z.infer<typeof documentQuestionSet>;

export const DOCUMENT_EVAL_FOLDER = 'documents';
export const DOCUMENT_QUESTIONS_FILE = 'questions.v1.json';

export function loadDocumentQuestionSet(
  root = evalRoot(),
): DocumentQuestionSet {
  const raw: unknown = JSON.parse(
    readFileSync(
      join(root, DOCUMENT_EVAL_FOLDER, DOCUMENT_QUESTIONS_FILE),
      'utf8',
    ),
  );
  return documentQuestionSet.parse(raw);
}
