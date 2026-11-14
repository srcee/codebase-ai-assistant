import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { SearchCandidate } from '../types/search-candidate';
import { toSearchCandidate } from '../mappers/search-candidate.mapper';
import { buildLexicalQuery } from '../utils/build-lexical-query';
import { candidateColumns } from '../utils/candidate-columns';

const { chunks, sources, sourceFiles } = schema;

@Injectable()
export class LexicalSearchService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(
    text: string,
    sourceIds: readonly string[],
  ): Promise<SearchCandidate[]> {
    const query = buildLexicalQuery(text);
    if (!query || sourceIds.length === 0) return [];

    const tsquery = sql`to_tsquery('simple', ${query.tsquery})`;
    const phraseBonus = sql`case when ${chunks.searchVector} @@ phraseto_tsquery('simple', ${query.phrase}) then 1 else 0 end`;
    const rank = sql`ts_rank_cd(${chunks.searchVector}, ${tsquery}, 1) + ${phraseBonus}`;

    const rows = await this.database.db
      .select(candidateColumns)
      .from(chunks)
      .innerJoin(
        sourceFiles,
        and(
          eq(sourceFiles.id, chunks.fileId),
          eq(sourceFiles.sourceId, chunks.sourceId),
        ),
      )
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(
        and(
          inArray(chunks.sourceId, [...sourceIds]),
          sql`${chunks.searchVector} @@ ${tsquery}`,
        ),
      )
      .orderBy(desc(rank), asc(chunks.id))
      .limit(this.config.retrieval.candidateLimit);
    return rows.map(toSearchCandidate);
  }
}
