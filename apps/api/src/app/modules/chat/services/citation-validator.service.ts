import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Citation } from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { RetrievedChunk } from '../../retrieval/types/retrieved-chunk';
import { toCitation } from '../mappers/to-citation';
import { sameLocator } from '../utils/same-locator';

const { chunks, sourceFiles } = schema;

@Injectable()
export class CitationValidatorService {
  constructor(private readonly database: DatabaseService) {}

  /** Re-checks chunks in SQL, since re-indexing during generation can remove or move them. */
  async validate(
    numbers: readonly number[],
    evidence: readonly RetrievedChunk[],
    sourceIds: readonly string[],
  ): Promise<Citation[]> {
    const inRange = numbers.filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= evidence.length,
    );
    if (inRange.length === 0 || sourceIds.length === 0) return [];

    const rows = await this.database.db
      .select({
        id: chunks.id,
        sourceId: chunks.sourceId,
        relativePath: sourceFiles.relativePath,
        locator: chunks.locator,
      })
      .from(chunks)
      .innerJoin(
        sourceFiles,
        and(
          eq(sourceFiles.id, chunks.fileId),
          eq(sourceFiles.sourceId, chunks.sourceId),
        ),
      )
      .where(
        and(
          inArray(
            chunks.id,
            inRange.map((n) => evidence[n - 1].chunkId),
          ),
          inArray(chunks.sourceId, [...sourceIds]),
        ),
      );
    const stored = new Map(rows.map((row) => [row.id, row]));

    return inRange
      .filter((n) => {
        const chunk = evidence[n - 1];
        const row = stored.get(chunk.chunkId);
        return (
          row !== undefined &&
          row.sourceId === chunk.sourceId &&
          row.relativePath === chunk.relativePath &&
          sameLocator(chunk.locator, row.locator)
        );
      })
      .sort((a, b) => a - b)
      .map((n) => toCitation(evidence[n - 1], n));
  }
}
