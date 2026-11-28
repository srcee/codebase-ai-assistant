import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import {
  DatabaseService,
  type DatabaseTransaction,
  schema,
} from '@codebase-ai/server-database';
import { BlobMissingError } from '../errors/blob-missing.error';
import { sha256Hex } from '../../ingestion/utils/sha256-hex';
import type { ReceivedBlob, ReceiveOutcome } from '../types/received-blob';

const { documents } = schema;

const HASH_PATTERN = /^[0-9a-f]{64}$/;
// Uploads take it shared and the sweep exclusive, so a blob is never deleted while a row starts to reference it.
const LOCK_KEY = sql`hashtext('codebase-ai:blob-store')`;
// Temp files this old belong to no running upload.
const STALE_TEMP_MS = 24 * 60 * 60 * 1000;

/** Content-addressed store for uploaded originals under DATA_DIR. Logs hashes and counts only. */
@Injectable()
export class BlobStoreService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BlobStoreService.name);
  private readonly blobRoot: string;
  private readonly tempRoot: string;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly database: DatabaseService,
  ) {
    this.blobRoot = join(config.documents.dataDir, 'blobs', 'sha256');
    this.tempRoot = join(config.documents.dataDir, 'tmp');
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.removeStaleTempFiles();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Could not clean upload temp files: ${name}`);
    }
  }

  /** Streams to a temp file while hashing; bytes past `maxBytes` are drained, not written. */
  async receive(source: Readable, maxBytes: number): Promise<ReceiveOutcome> {
    // A source that fails before the pipeline is attached still rejects it, as an errored stream.
    source.on('error', () => undefined);
    await mkdir(this.tempRoot, { recursive: true });
    const tempPath = join(this.tempRoot, randomUUID());
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        sizeBytes += chunk.length;
        if (sizeBytes > maxBytes) return done();
        hash.update(chunk);
        done(null, chunk);
      },
    });
    try {
      await pipeline(
        source,
        meter,
        createWriteStream(tempPath, { flags: 'wx' }),
      );
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    if (sizeBytes > maxBytes) {
      await rm(tempPath, { force: true });
      return { kind: 'too-large' };
    }
    return {
      kind: 'received',
      blob: { hash: hash.digest('hex'), sizeBytes, tempPath },
    };
  }

  /** Moves the temp file into the store; call inside the transaction that writes the referencing row. */
  async store(tx: DatabaseTransaction, blob: ReceivedBlob): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(${LOCK_KEY})`);
    const target = this.pathFor(blob.hash);
    if (await exists(target)) {
      await this.discard(blob);
      return;
    }
    await mkdir(dirname(target), { recursive: true });
    try {
      await rename(blob.tempPath, target);
    } catch (error) {
      // Another upload of the same content won the race.
      if (!(await exists(target))) throw error;
      await this.discard(blob);
    }
  }

  async discard(blob: ReceivedBlob): Promise<void> {
    await rm(blob.tempPath, { force: true });
  }

  /** Verifies the content against its hash, so a damaged blob is never indexed. */
  async read(hash: string): Promise<Uint8Array> {
    if (!HASH_PATTERN.test(hash)) throw new BlobMissingError();
    let bytes: Uint8Array;
    try {
      bytes = await readFile(this.pathFor(hash));
    } catch (error) {
      if (isNotFound(error)) throw new BlobMissingError();
      throw error;
    }
    if (sha256Hex(bytes) !== hash) throw new BlobMissingError();
    return bytes;
  }

  /** Deletes blobs no document references; safe to run any time and to run again after a failure. */
  async sweep(): Promise<number> {
    const removed = await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
      const stored = await this.storedHashes();
      if (stored.length === 0) return 0;
      const referenced = new Set(
        (
          await tx.selectDistinct({ hash: documents.blobHash }).from(documents)
        ).map((row) => row.hash),
      );
      let count = 0;
      for (const hash of stored) {
        if (referenced.has(hash)) continue;
        await rm(this.pathFor(hash), { force: true });
        count++;
      }
      return count;
    });
    if (removed > 0) this.logger.log(`Blob sweep removed=${removed}`);
    return removed;
  }

  /** For use after the rows are gone: a failure is logged and the blob waits for the next sweep. */
  async sweepQuietly(): Promise<void> {
    try {
      await this.sweep();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Blob sweep failed: ${name}`);
    }
  }

  private pathFor(hash: string): string {
    return join(this.blobRoot, hash.slice(0, 2), hash);
  }

  private async storedHashes(): Promise<string[]> {
    const hashes: string[] = [];
    for (const prefix of await listOrEmpty(this.blobRoot)) {
      for (const name of await listOrEmpty(join(this.blobRoot, prefix))) {
        if (HASH_PATTERN.test(name) && name.startsWith(prefix)) {
          hashes.push(name);
        }
      }
    }
    return hashes;
  }

  private async removeStaleTempFiles(): Promise<void> {
    const cutoff = Date.now() - STALE_TEMP_MS;
    for (const name of await listOrEmpty(this.tempRoot)) {
      const path = join(this.tempRoot, name);
      const info = await stat(path).catch(() => undefined);
      if (info && info.mtimeMs < cutoff) await rm(path, { force: true });
    }
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function listOrEmpty(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}
