/** A run of source text that a window may hold whole or split. */
export interface ProseBlock {
  text: string;
  /** 1-based, inclusive; table chunks use row numbers instead of lines. */
  startLine: number;
  endLine: number;
}

export interface ProseWindow {
  text: string;
  startLine: number;
  endLine: number;
}
