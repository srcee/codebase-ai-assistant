/** Returns the character count of lines startLine..endLine joined with LF, using prefix sums. */
export function createRangeMeasure(
  lines: readonly string[],
): (startLine: number, endLine: number) => number {
  const prefix: number[] = [0];
  for (const line of lines)
    prefix.push(prefix[prefix.length - 1] + line.length + 1);
  return (startLine, endLine) => prefix[endLine] - prefix[startLine - 1] - 1;
}
