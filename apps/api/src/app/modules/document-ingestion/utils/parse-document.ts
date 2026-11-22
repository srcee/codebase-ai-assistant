import { containsSecret } from '../../ingestion/utils/contains-secret';
import { decodeUtf8 } from '../../ingestion/utils/decode-utf8';
import { isBinary } from '../../ingestion/utils/is-binary';
import type { ChunkLimits } from '../../ingestion/types/line-range';
import type { DocumentChunk } from '../types/document-chunk';
import type { DocumentFormatId } from '../types/document-format';
import type { ParseRequest } from '../types/parse-request';
import type { ParseResult } from '../types/parse-result';
import { chunkMarkdown } from './chunk-markdown';
import { chunkPlainText } from './chunk-plain-text';
import { hasBinarySignature } from './has-binary-signature';

const CHUNKERS: Readonly<
  Record<
    DocumentFormatId,
    (text: string, limits: ChunkLimits) => DocumentChunk[]
  >
> = {
  markdown: chunkMarkdown,
  text: chunkPlainText,
};

/** Runs in the API thread or a parse worker; content problems are reported as skips, never thrown. */
export function parseDocument(request: ParseRequest): ParseResult {
  const { bytes } = request;
  if (isBinary(bytes) || hasBinarySignature(bytes)) {
    return { kind: 'skipped', reason: 'binary' };
  }
  const text = decodeUtf8(bytes);
  if (text === undefined)
    return { kind: 'skipped', reason: 'invalid-encoding' };
  if (containsSecret(text))
    return { kind: 'skipped', reason: 'secret-content' };
  return {
    kind: 'chunks',
    chunks: CHUNKERS[request.format](text, request.limits),
  };
}
