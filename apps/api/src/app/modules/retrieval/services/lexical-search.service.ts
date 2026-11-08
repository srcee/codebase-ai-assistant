import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { SearchCandidate } from '../types/search-candidate';
import { buildLexicalQuery } from '../utils/build-lexical-query';
import { candidateColumns } from '../utils/candidate-columns';

const { codeChunks, repositories, repositoryFiles } = schema;

/** Full-text matches within the given repositories; an exact phrase ranks above scattered terms. */
@Injectable()
export class LexicalSearchService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(
    text: string,
    repositoryIds: readonly string[],
  ): Promise<SearchCandidate[]> {
    const query = buildLexicalQuery(text);
    if (!query || repositoryIds.length === 0) return [];

    const tsquery = sql`to_tsquery('simple', ${query.tsquery})`;
    const phraseBonus = sql`case when ${codeChunks.searchVector} @@ phraseto_tsquery('simple', ${query.phrase}) then 1 else 0 end`;
    const rank = sql`ts_rank_cd(${codeChunks.searchVector}, ${tsquery}, 1) + ${phraseBonus}`;

    return this.database.db
      .select(candidateColumns)
      .from(codeChunks)
      .innerJoin(
        repositoryFiles,
        and(
          eq(repositoryFiles.id, codeChunks.fileId),
          eq(repositoryFiles.repositoryId, codeChunks.repositoryId),
        ),
      )
      .innerJoin(repositories, eq(repositories.id, codeChunks.repositoryId))
      .where(
        and(
          inArray(codeChunks.repositoryId, [...repositoryIds]),
          sql`${codeChunks.searchVector} @@ ${tsquery}`,
        ),
      )
      .orderBy(desc(rank), asc(codeChunks.id))
      .limit(this.config.retrieval.candidateLimit);
  }
}
