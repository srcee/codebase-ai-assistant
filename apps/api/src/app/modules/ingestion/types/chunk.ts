import type { Language } from './language';

export interface Chunk {
  relativePath: string;
  language: Language;
  symbolName?: string;
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  /** The lines startLine..endLine joined with LF, without a trailing newline. */
  content: string;
  /** SHA-256 of `content`. */
  chunkHash: string;
}
