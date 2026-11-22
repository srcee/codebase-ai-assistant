import type { ChunkLimits } from '../../ingestion/types/line-range';
import { isBlank, splitLines } from '../../ingestion/utils/split-lines';
import type { DocumentChunk } from '../types/document-chunk';
import type { ProseBlock } from '../types/prose-block';
import { splitProseWindows } from './split-prose-windows';
import { toDocumentChunk } from './to-document-chunk';

/** Plain text has no structure to follow: paragraphs are packed into windows with a `lines` locator. */
export function chunkPlainText(
  text: string,
  limits: ChunkLimits,
): DocumentChunk[] {
  return splitProseWindows(
    paragraphsOf(splitLines(text)),
    limits.chunkMaxChars,
    limits.chunkOverlapChars,
  ).map((window) =>
    toDocumentChunk({
      title: null,
      contentKind: 'prose',
      locator: {
        kind: 'lines',
        startLine: window.startLine,
        endLine: window.endLine,
      },
      content: window.text,
    }),
  );
}

function paragraphsOf(lines: readonly string[]): ProseBlock[] {
  const paragraphs: ProseBlock[] = [];
  let start = -1;
  lines.forEach((line, index) => {
    if (!isBlank(line)) {
      if (start === -1) start = index;
      return;
    }
    if (start !== -1) paragraphs.push(paragraph(lines, start, index - 1));
    start = -1;
  });
  if (start !== -1) paragraphs.push(paragraph(lines, start, lines.length - 1));
  return paragraphs;
}

const paragraph = (
  lines: readonly string[],
  first: number,
  last: number,
): ProseBlock => ({
  text: lines.slice(first, last + 1).join('\n'),
  startLine: first + 1,
  endLine: last + 1,
});
