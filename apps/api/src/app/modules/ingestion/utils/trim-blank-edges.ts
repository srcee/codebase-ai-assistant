import type { LineRange } from '../types/line-range';
import { isBlank } from './split-lines';

/** Returns the range without leading and trailing blank lines, or undefined when nothing is left. */
export function trimBlankEdges(
  lines: readonly string[],
  startLine: number,
  endLine: number,
  symbolName?: string,
): LineRange | undefined {
  let start = startLine;
  let end = endLine;
  while (start <= end && isBlank(lines[start - 1])) start++;
  while (end >= start && isBlank(lines[end - 1])) end--;
  if (start > end) return undefined;
  return symbolName === undefined
    ? { startLine: start, endLine: end }
    : { startLine: start, endLine: end, symbolName };
}
