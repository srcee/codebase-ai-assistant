import ignore, { type Ignore } from 'ignore';

export interface PathMatcher {
  matches(relativePath: string, isDirectory: boolean): boolean;
}

/** Matches forward-slash relative paths against gitignore-syntax patterns, case-insensitively. */
export function createPathMatcher(patterns: readonly string[]): PathMatcher {
  const matcher: Ignore = ignore().add([...patterns]);
  return {
    matches: (relativePath, isDirectory) =>
      matcher.ignores(isDirectory ? `${relativePath}/` : relativePath),
  };
}
