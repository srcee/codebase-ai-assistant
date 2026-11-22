import type { DocumentFormat } from '../types/document-format';

/** Formats a document collection indexes; files with any other extension are skipped as unsupported-extension. */
export const DOCUMENT_FORMATS: readonly DocumentFormat[] = [
  {
    id: 'markdown',
    extensions: ['.md', '.markdown'],
    mediaType: 'text/markdown',
    encoding: 'text',
  },
  {
    id: 'text',
    extensions: ['.txt'],
    mediaType: 'text/plain',
    encoding: 'text',
  },
];
