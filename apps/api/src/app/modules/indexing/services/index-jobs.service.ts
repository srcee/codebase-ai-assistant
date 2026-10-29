import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type {
  IndexedFileIssue,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { toIndexJobResponse } from '../mappers/to-index-job-response';
import type { IndexJobCounters } from '../types/index-job-counters';

const { indexJobs, repositories, repositoryFiles } = schema;

type IndexJobRow = typeof indexJobs.$inferSelect;

const ACTIVE_STATUSES = ['queued', 'running'];
const MAX_ISSUES = 500;
const INTERRUPTED_SUMMARY = 'Interrupted by an API restart.';

export interface CreatedIndexJob {
  job: IndexJobRow;
  canonicalPath: string;
}

/** Index job rows and the repository status that mirrors them. */
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
        .update(repositories)
        .set({ status: 'failed' })
        .where(eq(repositories.status, 'indexing'));
      if (failed.length > 0) {
        this.logger.warn(
          `Marked ${failed.length} interrupted index jobs failed`,
        );
      }
    });
  }

  async create(repositoryId: string): Promise<CreatedIndexJob> {
    return this.database.db.transaction(async (tx) => {
      const [repository] = await tx
        .select({ canonicalPath: repositories.canonicalPath })
        .from(repositories)
        .where(eq(repositories.id, repositoryId));
      if (!repository) throw new NotFoundException('Codebase not found.');

      // The partial unique index allows one queued or running job per repository.
      const [job] = await tx
        .insert(indexJobs)
        .values({ repositoryId })
        .onConflictDoNothing()
        .returning();
      if (!job) {
        throw new ConflictException(
          'An index job is already active for this codebase.',
        );
      }
      await tx
        .update(repositories)
        .set({ status: 'indexing' })
        .where(eq(repositories.id, repositoryId));
      return { job, canonicalPath: repository.canonicalPath };
    });
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
    repositoryId: string,
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
        .update(repositories)
        .set({ status: outcome.status === 'succeeded' ? 'ready' : 'failed' })
        .where(eq(repositories.id, repositoryId));
    });
  }

  async repositoryExists(repositoryId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.id, repositoryId));
    return Boolean(row);
  }

  async latest(repositoryId: string): Promise<LatestIndexJobResponse> {
    const db = this.database.db;
    const [job] = await db
      .select()
      .from(indexJobs)
      .where(eq(indexJobs.repositoryId, repositoryId))
      .orderBy(desc(indexJobs.createdAt))
      .limit(1);
    if (!job) throw new NotFoundException('No index job for this codebase.');

    const issues = await db
      .select({
        relativePath: repositoryFiles.relativePath,
        status: repositoryFiles.status,
        reason: repositoryFiles.statusReason,
      })
      .from(repositoryFiles)
      .where(
        and(
          eq(repositoryFiles.repositoryId, repositoryId),
          inArray(repositoryFiles.status, ['skipped', 'failed']),
        ),
      )
      .orderBy(asc(repositoryFiles.relativePath))
      .limit(MAX_ISSUES);
    return {
      job: toIndexJobResponse(job),
      issues: issues as IndexedFileIssue[],
    };
  }
}
