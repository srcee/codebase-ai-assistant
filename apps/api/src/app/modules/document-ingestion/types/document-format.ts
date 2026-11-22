export type DocumentFormatId = 'markdown' | 'text';

export interface DocumentFormat {
  id: DocumentFormatId;
  /** Lower-case, with the leading dot. */
  extensions: readonly string[];
  mediaType: string;
  /** Binary formats always parse in a worker; text formats parse inline up to PARSE_INLINE_MAX_BYTES. */
  encoding: 'text' | 'binary';
}
