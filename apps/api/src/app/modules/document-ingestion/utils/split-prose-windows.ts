import type { ProseBlock, ProseWindow } from '../types/prose-block';

interface Piece {
  text: string;
  startLine: number;
  endLine: number;
  /** Joins the piece to the previous one in the same window. */
  separator: string;
}

const BLOCK_SEPARATOR = '\n\n';
const LINE_SEPARATOR = '\n';
const PART_SEPARATOR = ' ';
const SENTENCE_END = /(?<=[.!?;:])\s+/;
const WHITESPACE = /\s+/;

/**
 * Packs blocks in order into windows of at most `maxChars`; each window after the first starts with
 * up to `overlapChars` of the previous one and always advances. A block that does not fit is split
 * into lines, then sentences, then words, so long single-line paragraphs are kept, not skipped.
 */
export function splitProseWindows(
  blocks: readonly ProseBlock[],
  maxChars: number,
  overlapChars: number,
): ProseWindow[] {
  const overlapLimit = Math.min(overlapChars, Math.floor(maxChars / 2));
  const windows: ProseWindow[] = [];
  let current: Piece[] = [];
  let length = 0;
  for (const piece of blocks.flatMap((block) => piecesOf(block, maxChars))) {
    const fits = () =>
      length + piece.separator.length + piece.text.length <= maxChars;
    if (current.length > 0 && !fits()) {
      pushWindow(windows, current);
      current = overlapOf(current, overlapLimit);
      length = lengthOf(current);
      while (current.length > 0 && !fits()) {
        current = current.slice(1);
        length = lengthOf(current);
      }
    }
    length +=
      (current.length === 0 ? 0 : piece.separator.length) + piece.text.length;
    current.push(piece);
  }
  pushWindow(windows, current);
  return windows;
}

function piecesOf(block: ProseBlock, maxChars: number): Piece[] {
  if (block.text.length <= maxChars) {
    return [{ ...block, separator: BLOCK_SEPARATOR }];
  }
  return block.text.split(LINE_SEPARATOR).flatMap((line, index) => {
    const lineNumber = Math.min(block.startLine + index, block.endLine);
    return splitLine(line, maxChars).map((text, part) => ({
      text,
      startLine: lineNumber,
      endLine: lineNumber,
      separator:
        part > 0
          ? PART_SEPARATOR
          : index === 0
            ? BLOCK_SEPARATOR
            : LINE_SEPARATOR,
    }));
  });
}

function splitLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];
  return packParts(line.split(SENTENCE_END), maxChars, (sentence) =>
    packParts(sentence.split(WHITESPACE), maxChars, (word) =>
      hardCut(word, maxChars),
    ),
  );
}

/** Joins parts with single spaces into strings of at most `maxChars`; a part that is too long goes through `split`. */
function packParts(
  parts: readonly string[],
  maxChars: number,
  split: (part: string) => string[],
): string[] {
  const packed: string[] = [];
  let current = '';
  for (const part of parts.flatMap((part) =>
    part.length > maxChars ? split(part) : [part],
  )) {
    if (part === '') continue;
    if (current !== '' && current.length + 1 + part.length > maxChars) {
      packed.push(current);
      current = '';
    }
    current = current === '' ? part : `${current}${PART_SEPARATOR}${part}`;
  }
  if (current !== '') packed.push(current);
  return packed;
}

/** Splits by code point, so a surrogate pair is never cut. */
function hardCut(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const char of text) {
    if (piece !== '' && piece.length + char.length > maxChars) {
      pieces.push(piece);
      piece = '';
    }
    piece += char;
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}

/** The longest strict suffix of the window that fits in `overlapChars`. */
function overlapOf(pieces: readonly Piece[], overlapChars: number): Piece[] {
  const tail: Piece[] = [];
  let length = 0;
  for (let index = pieces.length - 1; index > 0; index--) {
    const piece = pieces[index];
    const added =
      piece.text.length + (tail.length === 0 ? 0 : tail[0].separator.length);
    if (length + added > overlapChars) break;
    tail.unshift(piece);
    length += added;
  }
  return tail;
}

function lengthOf(pieces: readonly Piece[]): number {
  return pieces.reduce(
    (sum, piece, index) =>
      sum + piece.text.length + (index === 0 ? 0 : piece.separator.length),
    0,
  );
}

function pushWindow(windows: ProseWindow[], pieces: readonly Piece[]): void {
  const isBlank = (piece: Piece) => piece.text.trim() === '';
  let first = 0;
  let last = pieces.length - 1;
  while (first <= last && isBlank(pieces[first])) first++;
  while (last >= first && isBlank(pieces[last])) last--;
  if (first > last) return;
  const kept = pieces.slice(first, last + 1);
  windows.push({
    text: kept
      .map((piece, index) => (index === 0 ? '' : piece.separator) + piece.text)
      .join(''),
    startLine: kept[0].startLine,
    endLine: kept[kept.length - 1].endLine,
  });
}
