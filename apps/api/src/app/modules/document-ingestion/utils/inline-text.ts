import type { Token } from 'markdown-it';

/** Visible text of an inline token: text, code spans and image alt text, with breaks as spaces and markup dropped. */
export function inlineText(token: Token | undefined): string {
  const parts: string[] = [];
  for (const child of token?.children ?? []) {
    if (child.type === 'text' || child.type === 'code_inline') {
      parts.push(child.content);
    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      parts.push(' ');
    } else if (child.type === 'image') {
      parts.push(inlineText(child));
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}
