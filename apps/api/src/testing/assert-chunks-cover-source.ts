import type { Chunk } from '../app/modules/ingestion/types/chunk';
import { splitLines } from '../app/modules/ingestion/utils/split-lines';

/** Every chunk must equal its source lines and every line outside all chunks must be blank. */
export function assertChunksCoverSource(
  text: string,
  chunks: readonly Chunk[],
): void {
  const lines = splitLines(text);
  const covered = new Set<number>();
  let previousStart = 0;

  for (const chunk of chunks) {
    expect(chunk.startLine).toBeGreaterThanOrEqual(1);
    expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
    expect(chunk.endLine).toBeLessThanOrEqual(lines.length);
    expect(chunk.startLine).toBeGreaterThanOrEqual(previousStart);
    previousStart = chunk.startLine;
    expect(chunk.content).toBe(
      lines.slice(chunk.startLine - 1, chunk.endLine).join('\n'),
    );
    for (let line = chunk.startLine; line <= chunk.endLine; line++) {
      covered.add(line);
    }
  }

  lines.forEach((line, index) => {
    if (!covered.has(index + 1)) expect(line.trim()).toBe('');
  });
}
