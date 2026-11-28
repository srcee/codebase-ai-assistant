import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type {
  DocumentOrigin,
  IndexedFileIssue,
  LatestIndexJobResponse,
  SourceKind,
} from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { NO_JOB_YET, SOURCE_NOT_FOUND } from '../constants/job-messages';
import { toIndexJobResponse } from '../mappers/to-index-job-response';
import type { IndexJobCounters } from '../types/index-job-counters';

const { indexJobs, sources, sourceFiles } = schema;

const sourceWithId = (id: string, kind?: SourceKind) =>
  kind ? and(eq(sources.id, id), eq(sources.kind, kind)) : eq(sources.id, id);

type IndexJobRow = typeof indexJobs.$inferSelect;

const ACTIVE_STATUSES = ['queued', 'running'];
const MAX_ISSUES = 500;
const INTERRUPTED_SUMMARY = 'Interrupted by an API restart.';

export interface IndexSource {
  id: string;
  kind: SourceKind;
  origin: DocumentOrigin | null;
  /** Null only for upload collections. */
  canonicalPath: string | null;
}

export interface CreatedIndexJob {
  job: IndexJobRow;
  source: IndexSource;
}

/** Index job rows and the source status that mirrors them. */
@Injectable()
export class IndexJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexJobsService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.databaseUrl) return;
    try {
      await this.failInterruptedJobs();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Could not recover interrupted index jobs: ${name}`);
    }
  }

  /** Jobs run in this process, so any active job left over from a previous process is dead. */
  async failInterruptedJobs(): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const failed = await tx
        .update(indexJobs)
        .set({
          status: 'failed',
          errorSummary: INTERRUPTED_SUMMARY,
          finishedAt: new Date(),
        })
        .where(inArray(indexJobs.status, ACTIVE_STATUSES))
        .returning({ id: indexJobs.id });
      await tx
        .update(sources)
        .set({ status: 'failed' })
        .where(eq(sources.status, 'indexing'));
      if (failed.length > 0) {
        this.logger.warn(
          `Marked ${failed.length} interrupted index jobs failed`,
        );
      }
    });
  }

  /** Queues a job for the source; undefined when it already has an active one. Without `kind`, any source matches. */
  async create(
    sourceId: string,
    kind?: SourceKind,
  ): Promise<CreatedIndexJob | undefined> {
    return this.database.db.transaction(async (tx) => {
      const [source] = await tx
        .select({
          id: sources.id,
          kind: sources.kind,
          origin: sources.origin,
          canonicalPath: sources.canonicalPath,
        })
        .from(sources)
        .where(sourceWithId(sourceId, kind));
      if (!source) {
        throw new NotFoundException(
          kind ? SOURCE_NOT_FOUND[kind] : 'Source not found.',
        );
      }

      // The partial unique index allows one queued or running job per source.
      const [job] = await tx
        .insert(indexJobs)
        .values({ sourceId })
        .onConflictDoNothing()
        .returning();
      if (!job) return undefined;
      await tx
        .update(sources)
        .set({ status: 'indexing' })
        .where(eq(sources.id, sourceId));
      return { job, source: source as IndexSource };
    });
  }

  async activeJob(sourceId: string): Promise<IndexJobRow | undefined> {
    const [job] = await this.database.db
      .select()
      .from(indexJobs)
      .where(
        and(
          eq(indexJobs.sourceId, sourceId),
          inArray(indexJobs.status, ACTIVE_STATUSES),
        ),
      )
      .limit(1);
    return job;
  }

  async markRunning(jobId: string): Promise<void> {
    await this.database.db
      .update(indexJobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(indexJobs.id, jobId));
  }

  async addCounters(
    jobId: string,
    delta: Partial<IndexJobCounters>,
  ): Promise<void> {
    const keys = Object.keys(delta) as (keyof IndexJobCounters)[];
    if (keys.length === 0) return;
    const set: Partial<Record<keyof IndexJobCounters, SQL>> = {};
    for (const key of keys) {
      set[key] = sql`${indexJobs[key]} + ${delta[key] ?? 0}`;
    }
    await this.database.db
      .update(indexJobs)
      .set(set)
      .where(eq(indexJobs.id, jobId));
  }

  async finish(
    jobId: string,
    sourceId: string,
    outcome: { status: 'succeeded' } | { status: 'failed'; summary: string },
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(indexJobs)
        .set({
          status: outcome.status,
          errorSummary: outcome.status === 'failed' ? outcome.summary : null,
          finishedAt: new Date(),
        })
        .where(eq(indexJobs.id, jobId));
      await tx
        .update(sources)
        .set({ status: outcome.status === 'succeeded' ? 'ready' : 'failed' })
        .where(eq(sources.id, sourceId));
    });
  }

  async sourceExists(sourceId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ id: sources.id })
      .from(sources)
      .where(sourceWithId(sourceId));
    return Boolean(row);
  }

  async latest(
    sourceId: string,
    kind: SourceKind,
  ): Promise<LatestIndexJobResponse> {
    const db = this.database.db;
    const [row] = await db
      .select({ job: indexJobs })
      .from(indexJobs)
      .innerJoin(
        sources,
        and(eq(sources.id, indexJobs.sourceId), eq(sources.kind, kind)),
      )
      .where(eq(indexJobs.sourceId, sourceId))
      .orderBy(desc(indexJobs.createdAt))
      .limit(1);
    if (!row) throw new NotFoundException(NO_JOB_YET[kind]);

    const issues = await db
      .select({
        relativePath: sourceFiles.relativePath,
        status: sourceFiles.status,
        reason: sourceFiles.statusReason,
      })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.sourceId, sourceId),
          inArray(sourceFiles.status, ['skipped', 'failed']),
        ),
      )
      .orderBy(asc(sourceFiles.relativePath))
      .limit(MAX_ISSUES);
    return {
      job: toIndexJobResponse(row.job),
      issues: issues as IndexedFileIssue[],
    };
  }
}
