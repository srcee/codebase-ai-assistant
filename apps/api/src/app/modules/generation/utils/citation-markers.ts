// Matches [1], [1, 2] and [1,2]; adjacent markers like [1][2] match one at a time.
const MARKER = /\[(\d{1,4}(?:\s*,\s*\d{1,4})*)\]/g;
// Code spans and fences hold things like items[0] that are not citations.
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

function mapOutsideCode(
  text: string,
  transform: (prose: string) => string,
): string {
  return text
    .split(CODE)
    .map((part, index) => (index % 2 === 1 ? part : transform(part)))
    .join('');
}

const numbersOf = (group: string): number[] =>
  group.split(',').map((value) => Number.parseInt(value.trim(), 10));

/** Citation numbers in order of first use, ignoring code. */
export function extractCitationNumbers(text: string): number[] {
  const found = new Set<number>();
  mapOutsideCode(text, (prose) => {
    for (const match of prose.matchAll(MARKER)) {
      numbersOf(match[1]).forEach((n) => found.add(n));
    }
    return prose;
  });
  return [...found];
}

/** Drops numbers `keep` rejects; a marker left empty is removed with the space before it. */
export function filterCitationNumbers(
  text: string,
  keep: (n: number) => boolean,
): string {
  return mapOutsideCode(text, (prose) =>
    prose.replace(
      new RegExp(`[ \\t]?${MARKER.source}`, 'g'),
      (whole: string, group: string) => {
        const numbers = numbersOf(group);
        const kept = numbers.filter(keep);
        if (kept.length === numbers.length) return whole;
        if (kept.length === 0) return '';
        return `${whole.startsWith('[') ? '' : whole[0]}[${kept.join(', ')}]`;
      },
    ),
  );
}
