import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { CHUNKING_BY_LANGUAGE } from '../constants/language-lookups';
import type { Chunk } from '../types/chunk';
import type { IncludedFile } from '../types/discovery-entry';
import type { ChunkLimits, LineRange } from '../types/line-range';
import { fileExtension } from '../utils/detect-language';
import { sha256Hex } from '../utils/sha256-hex';
import { splitIntoWindows } from '../utils/split-into-windows';
import { splitLines } from '../utils/split-lines';
import { typescriptRanges } from '../utils/typescript-ranges';

@Injectable()
export class ChunkingService {
  private readonly limits: ChunkLimits;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.limits = {
      chunkMaxChars: config.ingestion.chunkMaxChars,
      chunkOverlapChars: config.ingestion.chunkOverlapChars,
    };
  }

  /** Deterministic: the same file always yields the same chunks, ordered by start line. */
  chunk(file: IncludedFile): Chunk[] {
    const lines = splitLines(file.text);
    const ranges = this.ranges(file, lines);
    return ranges.map((range) => {
      const content = lines
        .slice(range.startLine - 1, range.endLine)
        .join('\n');
      return {
        relativePath: file.relativePath,
        language: file.language,
        ...(range.symbolName === undefined
          ? {}
          : { symbolName: range.symbolName }),
        startLine: range.startLine,
        endLine: range.endLine,
        content,
        chunkHash: sha256Hex(content),
      };
    });
  }

  private ranges(file: IncludedFile, lines: readonly string[]): LineRange[] {
    if (CHUNKING_BY_LANGUAGE.get(file.language) === 'typescript') {
      const symbolRanges = this.tryTypescriptRanges(file, lines);
      if (symbolRanges) return symbolRanges;
    }
    return splitIntoWindows(lines, 1, lines.length, this.limits);
  }

  // Source is untrusted: a parser failure such as a stack overflow on deep nesting falls back to line chunks.
  private tryTypescriptRanges(
    file: IncludedFile,
    lines: readonly string[],
  ): LineRange[] | undefined {
    try {
      return typescriptRanges(
        file.text,
        lines,
        fileExtension(file.relativePath),
        this.limits,
      );
    } catch {
      return undefined;
    }
  }
}
