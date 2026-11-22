import { join } from 'node:path';
import type { ParseWorkerEntry } from '../app/modules/document-ingestion/types/parse-worker-entry';
import { typescriptWorkerEntry } from '../app/modules/document-ingestion/utils/default-parse-worker-entry';

/** Text that makes the fixture parse worker misbehave on a document; any other document is parsed for real. */
export const PARSE_WORKER_MARKERS = {
  hang: 'fixture:hang-forever',
  exit: 'fixture:exit-worker',
  throw: 'fixture:throw-uncaught',
} as const;

export function fixtureParseWorkerEntry(): ParseWorkerEntry {
  return typescriptWorkerEntry(join(__dirname, 'fixture-parse-worker.ts'));
}
