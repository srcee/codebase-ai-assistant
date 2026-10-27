import { SECRET_CONTENT_PATTERNS } from '../constants/secret-content-patterns';

/** Reports only whether a pattern matched, never the match, so nothing sensitive can reach a log. */
export function containsSecret(text: string): boolean {
  return SECRET_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}
