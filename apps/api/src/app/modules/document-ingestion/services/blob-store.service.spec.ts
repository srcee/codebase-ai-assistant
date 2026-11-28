import {
  existsSync,
  mkdirSync,
  readdirSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import type {
  DatabaseService,
  DatabaseTransaction,
} from '@codebase-ai/server-database';
import {
  createSandbox,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { sha256Hex } from '../../ingestion/utils/sha256-hex';
import { BlobMissingError } from '../errors/blob-missing.error';
import type { ReceivedBlob } from '../types/received-blob';
import { BlobStoreService } from './blob-store.service';

describe('BlobStoreService', () => {
  let box: Sandbox;
  let referenced: string[];
  let tx: { execute: jest.Mock; selectDistinct: jest.Mock };
  let store: BlobStoreService;

  const blobPath = (hash: string) =>
    join(box.path, 'blobs', 'sha256', hash.slice(0, 2), hash);
  const tempFiles = () =>
    existsSync(join(box.path, 'tmp')) ? readdirSync(join(box.path, 'tmp')) : [];
  const asTx = () => tx as unknown as DatabaseTransaction;

  const receive = async (
    content: Buffer,
    maxBytes = 1024,
  ): Promise<ReceivedBlob> => {
    const outcome = await store.receive(Readable.from([content]), maxBytes);
    if (outcome.kind !== 'received') throw new Error('expected a blob');
    return outcome.blob;
  };

  beforeEach(() => {
    box = createSandbox('caa-blob-store-');
    referenced = [];
    tx = {
      execute: jest.fn().mockResolvedValue(undefined),
      selectDistinct: jest.fn(() => ({
        from: jest
          .fn()
          .mockImplementation(async () => referenced.map((hash) => ({ hash }))),
      })),
    };
    const database = {
      db: { transaction: async (work: (t: unknown) => unknown) => work(tx) },
    } as unknown as DatabaseService;
    store = new BlobStoreService(testConfig({ DATA_DIR: box.path }), database);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    box.dispose();
  });

  describe('receive', () => {
    it('hashes while streaming into a temp file', async () => {
      const content = Buffer.from(faker.lorem.paragraphs(3));
      const blob = await receive(content);
      expect(blob.hash).toBe(sha256Hex(content));
      expect(blob.sizeBytes).toBe(content.length);
      expect(tempFiles()).toHaveLength(1);
    });

    it('accepts a file of exactly the limit', async () => {
      const content = Buffer.alloc(64, 'a');
      expect((await receive(content, 64)).sizeBytes).toBe(64);
    });

    it('drains an oversized stream and leaves no temp file', async () => {
      const source = Readable.from([Buffer.alloc(40), Buffer.alloc(40)]);
      expect(await store.receive(source, 64)).toEqual({ kind: 'too-large' });
      expect(source.readableEnded).toBe(true);
      expect(tempFiles()).toEqual([]);
    });

    it('removes the temp file when the stream fails', async () => {
      const source = new Readable({
        read() {
          this.push(Buffer.alloc(8));
          this.destroy(new Error('client aborted'));
        },
      });
      await expect(store.receive(source, 1024)).rejects.toThrow(
        'client aborted',
      );
      expect(tempFiles()).toEqual([]);
    });
  });

  describe('store and read', () => {
    it('moves the blob under its hash inside a shared lock', async () => {
      const content = Buffer.from(faker.lorem.sentence());
      const blob = await receive(content);
      await store.store(asTx(), blob);

      expect(tx.execute).toHaveBeenCalledTimes(1);
      expect(existsSync(blobPath(blob.hash))).toBe(true);
      expect(tempFiles()).toEqual([]);
      expect(Buffer.from(await store.read(blob.hash))).toEqual(content);
    });

    it('keeps one copy of the same content', async () => {
      const content = Buffer.from(faker.lorem.sentence());
      const first = await receive(content);
      const second = await receive(content);
      await store.store(asTx(), first);
      await store.store(asTx(), second);
      expect(readdirSync(join(blobPath(first.hash), '..'))).toEqual([
        first.hash,
      ]);
      expect(tempFiles()).toEqual([]);
    });

    it('discards a received blob', async () => {
      await store.discard(await receive(Buffer.from('x')));
      expect(tempFiles()).toEqual([]);
    });

    it.each([
      ['a missing blob', 'a'.repeat(64)],
      ['a malformed hash', '../../secrets'],
    ])('reports %s without a path', async (_label, hash) => {
      const error = await store.read(hash).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BlobMissingError);
      expect((error as Error).message).not.toContain(box.path);
    });

    it('refuses a blob whose content no longer matches its hash', async () => {
      const blob = await receive(Buffer.from(faker.lorem.sentence()));
      await store.store(asTx(), blob);
      writeFileSync(blobPath(blob.hash), 'tampered');
      await expect(store.read(blob.hash)).rejects.toBeInstanceOf(
        BlobMissingError,
      );
    });
  });

  describe('sweep', () => {
    it('deletes unreferenced blobs and keeps referenced ones', async () => {
      const kept = await receive(Buffer.from('kept'));
      const dropped = await receive(Buffer.from('dropped'));
      await store.store(asTx(), kept);
      await store.store(asTx(), dropped);
      referenced = [kept.hash];
      const logged = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      expect(await store.sweep()).toBe(1);
      expect(existsSync(blobPath(kept.hash))).toBe(true);
      expect(existsSync(blobPath(dropped.hash))).toBe(false);
      expect(JSON.stringify(logged.mock.calls)).not.toContain(box.path);
    });

    it('ignores foreign files and an empty store', async () => {
      expect(await store.sweep()).toBe(0);
      const prefix = join(box.path, 'blobs', 'sha256', 'ab');
      mkdirSync(prefix, { recursive: true });
      writeFileSync(join(prefix, 'notes.txt'), 'x');
      expect(await store.sweep()).toBe(0);
      expect(readdirSync(prefix)).toEqual(['notes.txt']);
    });
  });

  describe('bootstrap', () => {
    it('removes only stale temp files', async () => {
      const fresh = await receive(Buffer.from('fresh'));
      const stale = await receive(Buffer.from('stale'));
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      utimesSync(stale.tempPath, old, old);

      await store.onApplicationBootstrap();
      expect(existsSync(fresh.tempPath)).toBe(true);
      expect(existsSync(stale.tempPath)).toBe(false);
    });

    it('tolerates a missing data directory', async () => {
      await expect(store.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
