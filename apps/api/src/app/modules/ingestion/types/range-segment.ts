import type { LineRange } from './line-range';

export interface RangeSegment extends LineRange {
  /** Sub-ranges to use instead of line windows when the segment exceeds the chunk size. */
  split?: () => readonly LineRange[];
}
