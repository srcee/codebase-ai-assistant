const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const MIN_PART_LENGTH = 2;
const MAX_TERMS = 1000;

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

/** Space-separated, de-duplicated parts of the compound identifiers in `text`, for full-text matching. */
export function searchTermsFor(text: string): string {
  const terms = new Set<string>();
  for (const [identifier] of text.matchAll(IDENTIFIER)) {
    for (const part of splitIdentifier(identifier)) {
      terms.add(part);
      if (terms.size >= MAX_TERMS) return [...terms].join(' ');
    }
  }
  return [...terms].join(' ');
}
