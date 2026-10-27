import type { SkipReason } from '../types/skip-reason';
import { containsSecret } from './contains-secret';
import { decodeUtf8 } from './decode-utf8';
import { isBinary } from './is-binary';

export type ContentInspection =
  | { kind: 'text'; text: string }
  | { kind: 'skip'; reason: SkipReason };

/** Decides from the bytes alone whether a file may be indexed; the returned reason never carries content. */
export function inspectContent(
  bytes: Uint8Array,
  maxLineChars: number,
): ContentInspection {
  if (isBinary(bytes)) return { kind: 'skip', reason: 'binary' };

  const text = decodeUtf8(bytes);
  if (text === undefined) return { kind: 'skip', reason: 'invalid-encoding' };

  // A line longer than a chunk cannot be cut on a line boundary; it is almost always minified or generated.
  if (text.split('\n').some((line) => line.length > maxLineChars)) {
    return { kind: 'skip', reason: 'line-too-long' };
  }
  if (containsSecret(text)) return { kind: 'skip', reason: 'secret-content' };
  return { kind: 'text', text };
}
