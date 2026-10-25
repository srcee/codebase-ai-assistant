import type { ChunkLimits, LineRange } from '../types/line-range';
import { trimBlankEdges } from './trim-blank-edges';

/**
 * Splits startLine..endLine into windows of whole lines of at most `chunkMaxChars`.
 * Each window after the first repeats up to `chunkOverlapChars` of the previous one and always advances.
 */
export function splitIntoWindows(
  lines: readonly string[],
  startLine: number,
  endLine: number,
  limits: ChunkLimits,
  symbolName?: string,
): LineRange[] {
  const windows: LineRange[] = [];
  let first = startLine;
  while (first <= endLine) {
    let last = first;
    let size = lines[first - 1].length;
    while (
      last < endLine &&
      size + 1 + lines[last].length <= limits.chunkMaxChars
    ) {
      size += 1 + lines[last].length;
      last++;
    }
    const window = trimBlankEdges(lines, first, last, symbolName);
    if (window) windows.push(window);
    if (last >= endLine) break;

    let next = last + 1;
    let overlap = 0;
    while (
      next - 1 > first &&
      overlap + 1 + lines[next - 2].length <= limits.chunkOverlapChars
    ) {
      overlap += 1 + lines[next - 2].length;
      next--;
    }
    first = next;
  }
  return windows;
}
