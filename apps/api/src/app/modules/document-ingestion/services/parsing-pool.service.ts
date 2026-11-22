import { Worker } from 'node:worker_threads';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  APP_CONFIG,
  type AppConfig,
  type ParsingConfig,
} from '@codebase-ai/server-config';
import { ParseCancelledError } from '../errors/parse-cancelled.error';
import type {
  ParseTaskMessage,
  ParseWorkerMessage,
} from '../types/parse-messages';
import type { ParseRequest } from '../types/parse-request';
import type { ParseFailureCode, ParseResult } from '../types/parse-result';
import {
  PARSE_WORKER_ENTRY,
  type ParseWorkerEntry,
} from '../types/parse-worker-entry';
import { toTransferable } from '../utils/to-transferable';

// A worker that has not loaded by then counts as crashed; PARSE_TIMEOUT_MS starts once it is ready.
const WORKER_START_TIMEOUT_MS = 30_000;

interface Task {
  id: number;
  request: ParseRequest;
  resolve: (result: ParseResult) => void;
  reject: (error: Error) => void;
  detach: () => void;
}

interface PoolWorker {
  worker: Worker;
  ready: boolean;
  running?: { task: Task; timer: NodeJS.Timeout };
}

type Settlement = { result: ParseResult } | { error: Error };

/**
 * A fixed pool of parse workers (decision 0011), started on demand and reused. One task runs per worker; a
 * timeout, crash, or out-of-memory fails that file with a reason code and the worker is replaced.
 */
@Injectable()
export class ParsingPoolService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(ParsingPoolService.name);
  private readonly limits: ParsingConfig;
  private readonly workers = new Set<PoolWorker>();
  private readonly idle: PoolWorker[] = [];
  private readonly queue: Task[] = [];
  private nextTaskId = 1;
  private closed = false;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(PARSE_WORKER_ENTRY) private readonly entry: ParseWorkerEntry,
  ) {
    this.limits = config.parsing;
  }

  /** The bytes are transferred to the worker; rejects with ParseCancelledError when aborted or shut down. */
  parse(request: ParseRequest, signal?: AbortSignal): Promise<ParseResult> {
    if (this.closed || signal?.aborted) {
      return Promise.reject(new ParseCancelledError());
    }
    return new Promise<ParseResult>((resolve, reject) => {
      const onAbort = () => this.cancel(task);
      const task: Task = {
        id: this.nextTaskId++,
        request: { ...request, bytes: toTransferable(request.bytes) },
        resolve,
        reject,
        detach: () => signal?.removeEventListener('abort', onAbort),
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.queue.push(task);
      this.dispatch();
    });
  }

  // Order-independent: if jobs are still running, their parses are cancelled, never recorded as failed files.
  async beforeApplicationShutdown(): Promise<void> {
    this.closed = true;
    for (const task of this.queue.splice(0)) {
      settle(task, { error: new ParseCancelledError() });
    }
    await Promise.all(
      [...this.workers].map((member) =>
        this.retire(member, { error: new ParseCancelledError() }),
      ),
    );
  }

  private dispatch(): void {
    while (!this.closed && this.queue.length > 0) {
      const member =
        this.idle.pop() ??
        (this.workers.size < this.limits.workers ? this.spawn() : undefined);
      if (!member) return;
      this.run(member, this.queue.shift() as Task);
    }
  }

  private spawn(): PoolWorker {
    const worker = new Worker(this.entry.filename, {
      eval: this.entry.eval,
      resourceLimits: { maxOldGenerationSizeMb: this.limits.workerMaxMemoryMb },
    });
    const member: PoolWorker = { worker, ready: false };
    worker.on('message', (message: ParseWorkerMessage) =>
      this.onMessage(member, message),
    );
    worker.on('error', () => void this.replace(member, 'parse_crashed'));
    worker.on('exit', () => void this.replace(member, 'parse_crashed'));
    // An idle worker must not keep the process alive.
    worker.unref();
    this.workers.add(member);
    return member;
  }

  private run(member: PoolWorker, task: Task): void {
    member.running = { task, timer: this.startTimer(member) };
    if (member.ready) this.post(member, task);
  }

  private startTimer(member: PoolWorker): NodeJS.Timeout {
    return member.ready
      ? setTimeout(
          () => void this.replace(member, 'parse_timeout'),
          this.limits.timeoutMs,
        )
      : setTimeout(
          () => void this.replace(member, 'parse_crashed'),
          WORKER_START_TIMEOUT_MS,
        );
  }

  private post(member: PoolWorker, task: Task): void {
    const message: ParseTaskMessage = { id: task.id, request: task.request };
    member.worker.postMessage(message, [
      task.request.bytes.buffer as ArrayBuffer,
    ]);
  }

  private onMessage(member: PoolWorker, message: ParseWorkerMessage): void {
    const running = member.running;
    if (message.kind === 'ready') {
      member.ready = true;
      if (running) {
        clearTimeout(running.timer);
        running.timer = this.startTimer(member);
        this.post(member, running.task);
      }
      return;
    }
    if (!running || running.task.id !== message.id) return;
    clearTimeout(running.timer);
    member.running = undefined;
    settle(running.task, { result: message.result });
    this.idle.push(member);
    this.dispatch();
  }

  private async replace(
    member: PoolWorker,
    code: ParseFailureCode,
  ): Promise<void> {
    if (!this.workers.has(member)) return;
    const hadTask = member.running !== undefined;
    await this.retire(member, { result: { kind: 'failed', code } });
    if (hadTask) this.logger.warn(`Parse worker replaced: ${code}`);
    this.dispatch();
  }

  private cancel(task: Task): void {
    const queued = this.queue.indexOf(task);
    if (queued !== -1) {
      this.queue.splice(queued, 1);
      settle(task, { error: new ParseCancelledError() });
      return;
    }
    const member = [...this.workers].find(
      (candidate) => candidate.running?.task === task,
    );
    if (member) {
      void this.retire(member, { error: new ParseCancelledError() }).then(() =>
        this.dispatch(),
      );
    }
  }

  /** Removes the worker from the pool, settles its task with `outcome`, and terminates it. */
  private async retire(member: PoolWorker, outcome: Settlement): Promise<void> {
    this.workers.delete(member);
    const idleIndex = this.idle.indexOf(member);
    if (idleIndex !== -1) this.idle.splice(idleIndex, 1);
    const running = member.running;
    member.running = undefined;
    if (running) {
      clearTimeout(running.timer);
      settle(running.task, outcome);
    }
    await member.worker.terminate();
  }
}

function settle(task: Task, outcome: Settlement): void {
  task.detach();
  if ('error' in outcome) task.reject(outcome.error);
  else task.resolve(outcome.result);
}
