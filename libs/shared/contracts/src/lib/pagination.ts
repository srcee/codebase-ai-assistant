/** One page of a list; `nextCursor` is opaque and null on the last page. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageQuery {
  limit?: number;
  cursor?: string;
}
