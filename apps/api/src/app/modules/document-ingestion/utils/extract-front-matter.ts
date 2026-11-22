const OPENING_FENCE = '---';
const CLOSING_FENCES = new Set(['---', '...']);

export interface FrontMatter {
  /** Lines between the fences, as written. */
  lines: string[];
  /** Lines the block takes, fences included. */
  lineCount: number;
}

/** A YAML block that opens on the first line; without a closing fence the text is ordinary Markdown. */
export function extractFrontMatter(
  lines: readonly string[],
): FrontMatter | undefined {
  if (lines[0]?.trimEnd() !== OPENING_FENCE) return undefined;
  for (let index = 1; index < lines.length; index++) {
    if (CLOSING_FENCES.has(lines[index].trimEnd())) {
      return { lines: lines.slice(1, index), lineCount: index + 1 };
    }
  }
  return undefined;
}
