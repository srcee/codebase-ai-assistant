import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { LOGICAL_PATH_MAX_CHARS } from './normalize-logical-path';

// lower() can lengthen a few characters, such as 'İ'.
const cursorSchema = z
  .string()
  .min(1)
  .max(LOGICAL_PATH_MAX_CHARS * 2);

/** The lower-cased logical path of the last row; unique per collection. */
export function encodePathCursor(lowerPath: string): string {
  return Buffer.from(JSON.stringify(lowerPath)).toString('base64url');
}

export function decodePathCursor(value: string): string {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
  } catch {
    throw new BadRequestException('Invalid cursor.');
  }
}
