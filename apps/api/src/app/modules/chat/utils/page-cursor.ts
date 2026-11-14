import { z } from 'zod';
import { InvalidCursorError } from '../errors/invalid-cursor.error';

/** Position after the last row of a page; ordered by time, then id. */
export interface PageCursor {
  at: Date;
  id: string;
}

const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.at.toISOString(), cursor.id]),
  ).toString('base64url');
}

export function decodeCursor(value: string): PageCursor {
  try {
    const [at, id] = cursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    return { at: new Date(at), id };
  } catch {
    throw new InvalidCursorError();
  }
}
