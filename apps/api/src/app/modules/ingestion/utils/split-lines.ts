/** Splits on LF; a trailing newline does not add an empty last line and empty text has no lines. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function isBlank(line: string): boolean {
  return line.trim() === '';
}
