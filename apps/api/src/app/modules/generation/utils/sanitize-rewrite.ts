const MAX_QUERY_CHARS = 1000;
const FENCE = /```[\w-]*/g;
const LABEL = /^(?:standalone\s+)?(?:search\s+)?query\s*:\s*/i;
const QUOTES = /^["'`]+|["'`]+$/g;

/** The first non-empty line without fences, a label, or quotes; undefined when nothing usable remains. */
export function sanitizeRewrite(output: string): string | undefined {
  const line = output
    .replace(FENCE, '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value !== '');
  if (line === undefined) return undefined;
  const query = line
    .replace(LABEL, '')
    .replace(QUOTES, '')
    .replace(/\p{Cc}+/gu, ' ')
    .trim();
  return query === '' ? undefined : query.slice(0, MAX_QUERY_CHARS);
}
