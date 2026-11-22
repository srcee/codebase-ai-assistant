import type { DocumentFormatId } from '../types/document-format';

/** Bump a format's version when its chunk boundaries, content or hashing change; sync re-indexes its files on a mismatch. */
export const DOCUMENT_CHUNKING_VERSIONS: Readonly<
  Record<DocumentFormatId, string>
> = {
  markdown: 'markdown-1',
  text: 'text-1',
};
