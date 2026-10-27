import { posix } from 'node:path';
import {
  LANGUAGE_BY_EXTENSION,
  LANGUAGE_BY_FILENAME,
} from '../constants/language-lookups';
import type { Language } from '../types/language';

export function fileExtension(relativePath: string): string {
  return posix.extname(relativePath).toLowerCase();
}

/** Matches a well-known filename first, then the extension, both case-insensitively. */
export function detectLanguage(relativePath: string): Language | undefined {
  return (
    LANGUAGE_BY_FILENAME.get(posix.basename(relativePath).toLowerCase()) ??
    LANGUAGE_BY_EXTENSION.get(fileExtension(relativePath))
  );
}
