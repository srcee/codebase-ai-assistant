import type { ParseRequest } from '../types/parse-request';
import type { ParseResult } from '../types/parse-result';
import { parseDocument } from './parse-document';

export function handleParseRequest(request: ParseRequest): ParseResult {
  try {
    return parseDocument(request);
  } catch {
    // Parser errors can quote document text, so only the code leaves.
    return { kind: 'failed', code: 'parse_failed' };
  }
}
