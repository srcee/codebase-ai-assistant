import type { DocumentFormat } from '../types/document-format';

export function shouldParseInWorker(
  format: Pick<DocumentFormat, 'encoding'>,
  sizeBytes: number,
  inlineMaxBytes: number,
): boolean {
  return format.encoding === 'binary' || sizeBytes > inlineMaxBytes;
}
