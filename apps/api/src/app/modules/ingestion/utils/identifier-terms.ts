const WORD = /[A-Za-z0-9]+/g;
const MIN_PART_LENGTH = 2;
const MAX_TERMS = 2000;

/** Lower-case parts of a compound identifier; empty when it has a single part. */
export function splitIdentifier(identifier: string): string[] {
  const parts = identifier
    .split(/[^A-Za-z0-9]+/)
    .flatMap((piece) =>
      piece
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        // Keeps acronyms together: HTTPServer -> HTTP Server.
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(' '),
    )
    .map((part) => part.toLowerCase())
    .filter((part) => part.length >= MIN_PART_LENGTH);
  return parts.length > 1 ? parts : [];
}

/**
 * Space-separated, de-duplicated lower-case words of `text` plus the parts of camelCase words.
 * Postgres keeps dotted and path-like text such as `this.userService.findOne` as one lexeme, so full-text search matches these words instead.
 */
export function searchTermsFor(text: string): string {
  const terms = new Set<string>();
  for (const [word] of text.matchAll(WORD)) {
    const lower = word.toLowerCase();
    if (lower.length >= MIN_PART_LENGTH) terms.add(lower);
    for (const part of splitIdentifier(word)) terms.add(part);
    if (terms.size >= MAX_TERMS) break;
  }
  return [...terms].slice(0, MAX_TERMS).join(' ');
}
