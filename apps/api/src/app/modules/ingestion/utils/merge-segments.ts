import type { RangeSegment } from '../types/range-segment';

/** Sorts segments and joins those that share a line; a joined segment keeps the first name and cannot be split. */
export function mergeSegments(
  segments: readonly RangeSegment[],
): RangeSegment[] {
  const sorted = [...segments].sort(
    (a, b) => a.startLine - b.startLine || a.endLine - b.endLine,
  );
  const merged: RangeSegment[] = [];
  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && segment.startLine <= previous.endLine) {
      merged[merged.length - 1] = {
        startLine: previous.startLine,
        endLine: Math.max(previous.endLine, segment.endLine),
        symbolName: previous.symbolName,
      };
    } else {
      merged.push(segment);
    }
  }
  return merged;
}
