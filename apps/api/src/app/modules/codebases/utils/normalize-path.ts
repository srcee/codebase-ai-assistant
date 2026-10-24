import { isAbsolute, normalize, parse, sep } from 'node:path';

const MAX_PATH_LENGTH = 4096;
const IS_WINDOWS = process.platform === 'win32';
const WINDOWS_DRIVE_PATH = /^[a-z]:[\\/]/i;

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) < 0x20) return true;
  }
  return false;
}

/** Absolute, local, and free of UNC, device, and alternate-data-stream forms. */
export function isLocalAbsolutePath(input: string): boolean {
  if (input.length === 0 || input.length > MAX_PATH_LENGTH) return false;
  if (hasControlCharacters(input)) return false;
  // Covers \\server\share, \\?\ and \\.\ on Windows; fail closed on every platform.
  if (/^[\\/]{2}/.test(input)) return false;
  if (!isAbsolute(input)) return false;
  if (IS_WINDOWS) {
    return WINDOWS_DRIVE_PATH.test(input) && !input.includes(':', 2);
  }
  return true;
}

export function hasTraversalSegment(input: string): boolean {
  const separators = IS_WINDOWS ? /[\\/]/ : /\//;
  return input.split(separators).includes('..');
}

/** Removes the \\?\ prefix, upper-cases the drive letter, and drops trailing separators. */
export function normalizeCanonicalPath(input: string): string {
  let normalized = input;
  if (IS_WINDOWS) {
    normalized = normalized.replace(/^\\\\\?\\(?=[a-z]:\\)/i, '');
    normalized = normalized.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
  }
  normalized = normalize(normalized);
  const { root } = parse(normalized);
  while (normalized.length > root.length && normalized.endsWith(sep)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
