export type ChunkingStrategy = 'typescript' | 'lines';

export interface LanguageDefinition {
  /** Stored with every file and chunk; lower-case letters, digits, `+`, `#` and `-` only. */
  id: string;
  /** Lower-case, with the leading dot. */
  extensions: readonly string[];
  /** Lower-case names of files without a telling extension, such as `dockerfile`. */
  filenames?: readonly string[];
  chunking: ChunkingStrategy;
}
