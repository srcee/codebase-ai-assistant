export interface LineRange {
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  symbolName?: string;
}

export interface ChunkLimits {
  chunkMaxChars: number;
  chunkOverlapChars: number;
}
