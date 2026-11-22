import { posix } from 'node:path';
import { DOCUMENT_FORMATS } from '../constants/document-formats';
import type { DocumentFormat } from '../types/document-format';

const FORMAT_BY_EXTENSION: ReadonlyMap<string, DocumentFormat> = new Map(
  DOCUMENT_FORMATS.flatMap((format) =>
    format.extensions.map((extension) => [extension, format] as const),
  ),
);

/** Matches the extension case-insensitively; undefined for formats no parser handles. */
export function documentFormatFor(
  relativePath: string,
): DocumentFormat | undefined {
  return FORMAT_BY_EXTENSION.get(posix.extname(relativePath).toLowerCase());
}
