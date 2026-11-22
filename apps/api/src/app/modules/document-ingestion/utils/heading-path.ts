import { truncate } from './truncate';

const MAX_HEADING_CHARS = 200;
const UNTITLED = '(untitled)';
const PATH_SEPARATOR = ' > ';

/** One heading path segment: bounded, and never empty, because locators require named segments. */
export function headingName(text: string): string {
  return truncate(text, MAX_HEADING_CHARS) || UNTITLED;
}

/** The joined heading path, cut so that as a chunk's first line it leaves room for content. */
export function titleOf(
  headingPath: readonly string[],
  maxChars: number,
): string {
  return truncate(
    headingPath.join(PATH_SEPARATOR),
    Math.max(1, Math.floor(maxChars / 4)),
  );
}
