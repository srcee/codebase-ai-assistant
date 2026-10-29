import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import type { IndexJobResponse } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { CHUNKING_VERSION } from '../../ingestion/constants/chunking-version';
import { FileDiscoveryService } from '../../ingestion/services/file-discovery.service';
import type { DiscoveryEntry } from '../../ingestion/types/discovery-entry';
import { IndexJobCancelledError } from '../errors/index-job-cancelled.error';
import { toIndexJobResponse } from '../mappers/to-index-job-response';
import type { FileOutcome } from '../types/file-outcome';
import type { IndexContext } from '../types/index-context';
import type { IndexJobCounters } from '../types/index-job-counters';
import { forEachConcurrent } from '../utils/for-each-concurrent';
import { summarizeIndexError } from '../utils/summarize-index-error';
import { FileIndexerService } from './file-indexer.service';
import { IndexJobsService } from './index-jobs.service';

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

/** Runs index jobs in the API process; one active job per repository is enforced by the database. */
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
    private readonly discovery: FileDiscoveryService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Creates the job and returns at once; progress is read from the job row. */
  async start(repositoryId: string): Promise<IndexJobResponse> {
    const { job, canonicalPath } = await this.jobs.create(repositoryId);
    const controller = new AbortController();
    const done = this.run(job.id, repositoryId, canonicalPath, controller)
      .catch((error: unknown) => {
        const name = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error(
          `Index job ${job.id} could not be finalized: ${name}`,
        );
      })
      .finally(() => this.running.delete(job.id));
    this.running.set(job.id, { controller, done });
    return toIndexJobResponse(job);
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

  private async run(
    jobId: string,
    repositoryId: string,
    canonicalPath: string,
    controller: AbortController,
  ): Promise<void> {
    const started = Date.now();
    const totals = emptyCounters();
    const context: IndexContext = {
      repositoryId,
      embeddingModel: this.embeddings.identity,
      chunkingVersion: CHUNKING_VERSION,
      signal: controller.signal,
    };
    const seenPaths = new Set<string>();

    try {
      await this.jobs.markRunning(jobId);
      await forEachConcurrent(
        this.discovery.discover(canonicalPath),
        this.config.indexing.embedConcurrency,
        async (entry) => {
          // Excluded directories are not walked, so they have no file row.
          if (entry.status === 'skipped' && entry.kind === 'directory') return;
          if (controller.signal.aborted) throw new IndexJobCancelledError();
          if (!(await this.jobs.repositoryExists(repositoryId))) {
            controller.abort();
            throw new IndexJobCancelledError();
          }
          seenPaths.add(entry.relativePath);
          try {
            const delta = countersFor(await this.processEntry(context, entry));
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
      const removed = await this.files.removeStale(repositoryId, seenPaths);
      await this.jobs.finish(jobId, repositoryId, { status: 'succeeded' });
      this.logger.log(
        `Index job ${jobId} succeeded: ${formatCounters(totals)} removed=${removed} durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      if (!(await this.jobs.repositoryExists(repositoryId))) {
        this.logger.log(`Index job ${jobId} cancelled: codebase deleted`);
        return;
      }
      await this.jobs.finish(jobId, repositoryId, {
        status: 'failed',
        summary: summarizeIndexError(error),
      });
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Index job ${jobId} failed: ${name} ${formatCounters(totals)} durationMs=${Date.now() - started}`,
      );
    }
  }

  private processEntry(
    context: IndexContext,
    entry: DiscoveryEntry,
  ): Promise<FileOutcome> {
    return entry.status === 'included'
      ? this.files.indexFile(context, entry)
      : this.files.recordSkipped(context, entry);
  }
}

function formatCounters(counters: IndexJobCounters): string {
  return `discovered=${counters.filesDiscovered} indexed=${counters.filesIndexed} skipped=${counters.filesSkipped} failed=${counters.filesFailed} chunks=${counters.chunksWritten}`;
}
