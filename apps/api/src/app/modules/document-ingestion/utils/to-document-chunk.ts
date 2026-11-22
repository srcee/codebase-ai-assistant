import { searchTermsFor } from '../../ingestion/utils/identifier-terms';
import { sha256Hex } from '../../ingestion/utils/sha256-hex';
import type { DocumentChunk } from '../types/document-chunk';

export function toDocumentChunk(
  fields: Omit<DocumentChunk, 'chunkHash' | 'searchTerms'>,
): DocumentChunk {
  return {
    ...fields,
    chunkHash: sha256Hex(fields.content),
    searchTerms: searchTermsFor(`${fields.title ?? ''}\n${fields.content}`),
  };
}
