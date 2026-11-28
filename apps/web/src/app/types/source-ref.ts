/** A code repository or a document collection, as the sources view manages it. */
export interface SourceRef {
  kind: 'codebase' | 'collection';
  id: string;
}
