import { join, resolve, sep } from 'node:path';
import { faker } from '@codebase-ai/shared-testing';
import {
  hasTraversalSegment,
  isLocalAbsolutePath,
  normalizeCanonicalPath,
} from './normalize-path';

const itOnWindows = process.platform === 'win32' ? it : it.skip;
const segment = () => faker.word.noun();
const absolute = (...parts: string[]) => resolve(sep, ...parts);

describe('isLocalAbsolutePath', () => {
  it('accepts an absolute local path', () => {
    expect(isLocalAbsolutePath(absolute(segment(), segment()))).toBe(true);
  });

  it.each([
    ['an empty string', () => ''],
    ['a relative path', () => join(segment(), segment())],
    ['a path with a control character', () => `${absolute(segment())}\u0001`],
    ['a path with a NUL byte', () => `${absolute(segment())}\u0000`],
    ['a UNC path', () => `\\\\${segment()}\\${segment()}`],
    ['a double-slash path', () => `//${segment()}/${segment()}`],
    ['an overlong path', () => absolute('a'.repeat(4097))],
  ])('rejects %s', (_name, input) => {
    expect(isLocalAbsolutePath(input())).toBe(false);
  });

  itOnWindows('rejects device and alternate-data-stream forms', () => {
    expect(isLocalAbsolutePath(`\\\\?\\C:\\${segment()}`)).toBe(false);
    expect(isLocalAbsolutePath(`C:\\${segment()}:stream`)).toBe(false);
  });
});

describe('hasTraversalSegment', () => {
  it('detects a ".." segment', () => {
    expect(hasTraversalSegment(`${absolute(segment())}${sep}..${sep}x`)).toBe(
      true,
    );
  });

  it('allows ".." inside a name', () => {
    expect(hasTraversalSegment(absolute(`${segment()}..${segment()}`))).toBe(
      false,
    );
  });
});

describe('normalizeCanonicalPath', () => {
  it('drops trailing separators', () => {
    const path = absolute(segment(), segment());
    expect(normalizeCanonicalPath(`${path}${sep}`)).toBe(path);
  });

  it('collapses "." segments', () => {
    const first = segment();
    const second = segment();
    expect(normalizeCanonicalPath(absolute(first, '.', second))).toBe(
      absolute(first, second),
    );
  });

  it('keeps the filesystem root intact', () => {
    const root = absolute();
    expect(normalizeCanonicalPath(root)).toBe(root);
  });

  itOnWindows(
    'upper-cases the drive letter and strips the \\\\?\\ prefix',
    () => {
      const name = segment();
      expect(normalizeCanonicalPath(`\\\\?\\c:\\${name}`)).toBe(`C:\\${name}`);
    },
  );
});
