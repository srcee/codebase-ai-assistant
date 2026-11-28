export const LOGICAL_PATH_MAX_CHARS = 512;
const DRIVE_LETTER = /^[a-z]:/i;
const CONTROL_CHARACTER = /\p{Cc}/u;

/** Forward-slash, NFC path inside a collection, or undefined for traversal, absolute, drive-letter, or control-character paths. */
export function normalizeLogicalPath(input: string): string | undefined {
  const path = input.normalize('NFC').replace(/\\/g, '/');
  if (path.length === 0 || path.length > LOGICAL_PATH_MAX_CHARS)
    return undefined;
  if (CONTROL_CHARACTER.test(path) || DRIVE_LETTER.test(path)) return undefined;
  const segments = path.split('/');
  if (segments.some((segment) => ['', '.', '..'].includes(segment))) {
    return undefined;
  }
  return path;
}
