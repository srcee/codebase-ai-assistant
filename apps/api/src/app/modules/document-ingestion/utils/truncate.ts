const ELLIPSIS = '…';

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;

/** Cuts text to at most `maxChars` UTF-16 units, ending with an ellipsis and never inside a surrogate pair. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let end = Math.max(0, maxChars - ELLIPSIS.length);
  if (end > 0 && isHighSurrogate(text.charCodeAt(end - 1))) end--;
  return `${text.slice(0, end)}${ELLIPSIS}`;
}
