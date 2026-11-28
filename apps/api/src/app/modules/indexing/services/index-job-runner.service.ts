import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import type { IndexJobResponse, SourceKind } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { CollectionDiscoveryService } from '../../document-ingestion/services/collection-discovery.service';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { FileDiscoveryService } from '../../ingestion/services/file-discovery.service';
import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import { JOB_ALREADY_ACTIVE } from '../constants/job-messages';
import { IndexJobCancelledError } from '../errors/index-job-cancelled.error';
import { toIndexJobResponse } from '../mappers/to-index-job-response';
import { runOutsideRequestContext } from '../../../utils/request-context';
import type { FileOutcome } from '../types/file-outcome';
import type { IndexContext } from '../types/index-context';
import type { IndexJobCounters } from '../types/index-job-counters';
import { forEachConcurrent } from '../utils/for-each-concurrent';
import { summarizeIndexError } from '../utils/summarize-index-error';
import { type WorkItem, workItems } from '../utils/work-items';
import { DocumentIndexerService } from './document-indexer.service';
import { FileIndexerService } from './file-indexer.service';
import {
  type CreatedIndexJob,
  IndexJobsService,
  type IndexSource,
} from './index-jobs.service';

// A job that finishes between the conflict and the lookup of the active job is retried this often.
const SYNC_ATTEMPTS = 3;

const emptyCounters = (): IndexJobCounters => ({
  filesDiscovered: 0,
  filesIndexed: 0,
  filesSkipped: 0,
  filesFailed: 0,
  chunksWritten: 0,
});

function countersFor(outcome: FileOutcome): Partial<IndexJobCounters> {
  switch (outcome.kind) {
    case 'indexed':
      return {
        filesDiscovered: 1,
        filesIndexed: 1,
        chunksWritten: outcome.chunksWritten,
      };
    case 'skipped':
      return { filesDiscovered: 1, filesSkipped: 1 };
    case 'failed':
      return { filesDiscovered: 1, filesFailed: 1 };
    case 'unchanged':
      return { filesDiscovered: 1 };
  }
}

/** Runs index jobs in the API process; one active job per source is enforced by the database. */
@Injectable()
export class IndexJobRunnerService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(IndexJobRunnerService.name);
  private readonly running = new Map<
    string,
    { controller: AbortController; done: Promise<void> }
  >();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jobs: IndexJobsService,
    private readonly files: FileIndexerService,
    private readonly documents: DocumentIndexerService,
    private readonly discovery: FileDiscoveryService,
    private readonly documentDiscovery: CollectionDiscoveryService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Creates the job and returns at once; progress is read from the job row. 409 while a job is active. */
  async start(sourceId: string, kind: SourceKind): Promise<IndexJobResponse> {
    const created = await this.jobs.create(sourceId, kind);
    if (!created) throw new ConflictException(JOB_ALREADY_ACTIVE[kind]);
    return this.launch(created);
  }

  /** Starts a job for a source of any kind, or reports the job that is already active instead of queueing another. */
  async trySync(
    sourceId: string,
  ): Promise<{ job: IndexJobResponse; alreadyActive: boolean }> {
    for (let attempt = 1; ; attempt++) {
      const created = await this.jobs.create(sourceId);
      if (created) return { job: this.launch(created), alreadyActive: false };
      const active = await this.jobs.activeJob(sourceId);
      if (active) {
        return { job: toIndexJobResponse(active), alreadyActive: true };
      }
      if (attempt === SYNC_ATTEMPTS) {
        throw new ConflictException('An index job is already active.');
      }
    }
  }

  /** Resolves when every job started by this process has finished. */
  async whenIdle(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all([...this.running.values()].map((job) => job.done));
    }
  }

  // Runs before any onApplicationShutdown hook, so the database pool is still open.
  async beforeApplicationShutdown(): Promise<void> {
    for (const job of this.running.values()) job.controller.abort();
    await this.whenIdle();
  }

  private launch({ job, source }: CreatedIndexJob): IndexJobResponse {
    const controller = new AbortController();
    this.logger.log(`Index job ${job.id} started source=${source.id}`);
    // Job lines are identified by job id, not by the request that started it.
    const done = runOutsideRequestContext(() =>
      this.run(job.id, source, controller)
        .catch((error: unknown) => {
          const name = error instanceof Error ? error.name : 'UnknownError';
          this.logger.error(
            `Index job ${job.id} could not be finalized: ${name}`,
          );
        })
        .finally(() => this.running.delete(job.id)),
    );
    this.running.set(job.id, { controller, done });
    return toIndexJobResponse(job);
  }

  private async run(
    jobId: string,
    source: IndexSource,
    controller: AbortController,
  ): Promise<void> {
    const started = Date.now();
    const totals = emptyCounters();
    const context: IndexContext = {
      sourceId: source.id,
      embeddingModel: this.embeddings.identity,
      signal: controller.signal,
    };
    const seenPaths = new Set<string>();

    try {
      await this.jobs.markRunning(jobId);
      await forEachConcurrent(
        this.workItemsFor(source, context),
        this.config.indexing.embedConcurrency,
        async (item) => {
          if (item.isDirectory) return;
          if (controller.signal.aborted) throw new IndexJobCancelledError();
          if (!(await this.jobs.sourceExists(source.id))) {
            controller.abort();
            throw new IndexJobCancelledError();
          }
          seenPaths.add(item.relativePath);
          try {
            const delta = countersFor(await item.process());
            for (const [key, value] of Object.entries(delta)) {
              totals[key as keyof IndexJobCounters] += value;
            }
            await this.jobs.addCounters(jobId, delta);
          } catch (error) {
            controller.abort();
            throw error;
          }
        },
      );
      const removed = await this.files.removeStale(source.id, seenPaths);
      await this.jobs.finish(jobId, source.id, { status: 'succeeded' });
      this.logger.log(
        `Index job ${jobId} succeeded: ${formatCounters(totals)} removed=${removed} durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      if (!(await this.jobs.sourceExists(source.id))) {
        this.logger.log(`Index job ${jobId} cancelled: source deleted`);
        return;
      }
      await this.jobs.finish(jobId, source.id, {
        status: 'failed',
        summary: summarizeIndexError(error),
      });
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Index job ${jobId} failed: ${name} ${formatCounters(totals)} durationMs=${Date.now() - started}`,
      );
    }
  }

  private workItemsFor(
    source: IndexSource,
    context: IndexContext,
  ): AsyncIterable<WorkItem> {
    const recordSkipped = (entry: SkippedEntry) =>
      this.files.recordSkipped(context, entry);
    return source.kind === 'code_repository'
      ? workItems(
          // The sources CHECK guarantees a path for repositories.
          this.discovery.discover(source.canonicalPath ?? ''),
          (file) => this.files.indexFile(context, file),
          recordSkipped,
        )
      : workItems(
          this.documentDiscovery.discover(source),
          (file) => this.documents.indexDocument(context, file),
          recordSkipped,
        );
  }
}

function formatCounters(counters: IndexJobCounters): string {
  return `discovered=${counters.filesDiscovered} indexed=${counters.filesIndexed} skipped=${counters.filesSkipped} failed=${counters.filesFailed} chunks=${counters.chunksWritten}`;
}
