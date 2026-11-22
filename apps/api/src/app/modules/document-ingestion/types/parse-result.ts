import type { SkipReason } from '../../ingestion/types/skip-reason';
import type { DocumentChunk } from './document-chunk';

export const PARSE_FAILURE_CODES = [
  'parse_timeout',
  'parse_crashed',
  'parse_failed',
] as const;

export type ParseFailureCode = (typeof PARSE_FAILURE_CODES)[number];

/** Content problems are skips; parser problems are failures that carry a code only, never document text. */
export type ParseResult =
  | { kind: 'chunks'; chunks: DocumentChunk[] }
  | { kind: 'skipped'; reason: SkipReason }
  | { kind: 'failed'; code: ParseFailureCode };
