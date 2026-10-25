import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import {
  buildSampleRepository,
  createSandbox,
  linkDirectory,
  makeGitRepository,
  type SampleRepository,
  testConfig,
  writeFiles,
} from '@codebase-ai/server-testing';
import { assertNotLeaked, CANARY_SECRET } from '@codebase-ai/shared-testing';
import { assertChunksCoverSource } from '../../../testing/assert-chunks-cover-source';
import { createTestApp } from '../../../testing/create-test-app';
import { PathRejectedError } from '../codebases/errors/path-rejected.error';
import { PathPolicyService } from '../codebases/services/path-policy.service';
import { RepositoryRootChangedError } from './errors/repository-root-changed.error';
import { UnknownLanguageError } from './errors/unknown-language.error';
import { ChunkingService } from './services/chunking.service';
import { ExclusionPolicyService } from './services/exclusion-policy.service';
import { FileDiscoveryService } from './services/file-discovery.service';
import type { Chunk } from './types/chunk';
import type { DiscoveryEntry } from './types/discovery-entry';
import { sha256Hex } from './utils/sha256-hex';

const LIMITS = {
  INGEST_MAX_FILE_BYTES: '4096',
  INGEST_MAX_TOTAL_BYTES: '1000000',
  CHUNK_MAX_CHARS: '400',
  CHUNK_OVERLAP_CHARS: '80',
  INGEST_EXCLUDE_PATTERNS: 'scratch/',
};

describe('ingestion', () => {
  const box = createSandbox('caa-ingestion-');
  let sample: SampleRepository;
  let canonicalPath: string;
  let app: INestApplication;
  let discovery: FileDiscoveryService;
  let chunking: ChunkingService;

  const configFor = (env: Record<string, string> = {}) =>
    testConfig({ ALLOWED_REPO_ROOTS: box.root, ...LIMITS, ...env });

  const collect = async (
    service: FileDiscoveryService,
    path: string,
  ): Promise<DiscoveryEntry[]> => {
    const entries: DiscoveryEntry[] = [];
    for await (const entry of service.discover(path)) entries.push(entry);
    return entries;
  };

  const chunksOf = (entries: DiscoveryEntry[]): Chunk[] =>
    entries.flatMap((entry) =>
      entry.status === 'included' ? chunking.chunk(entry) : [],
    );

  const standaloneDiscovery = (env: Record<string, string> = {}) => {
    const config = configFor(env);
    return new FileDiscoveryService(
      config,
      new PathPolicyService(config),
      new ExclusionPolicyService(config),
    );
  };

  beforeAll(async () => {
    sample = buildSampleRepository(box);
    canonicalPath = (
      await new PathPolicyService(configFor()).resolve(sample.path)
    ).canonicalPath;
    app = await createTestApp({ config: configFor() });
    discovery = app.get(FileDiscoveryService, { strict: false });
    chunking = app.get(ChunkingService, { strict: false });
  });

  afterAll(async () => {
    await app?.close();
    box.dispose();
  });

  it('produces stable decisions and chunks for the sample repository', async () => {
    const entries = await collect(discovery, canonicalPath);
    const decisions = entries.map((entry) =>
      entry.status === 'included'
        ? {
            path: entry.relativePath,
            included: true,
            language: entry.language,
            sizeBytes: entry.sizeBytes,
            contentHash: entry.contentHash,
          }
        : {
            path: entry.relativePath,
            included: false,
            kind: entry.kind,
            reason: entry.reason,
          },
    );
    const chunks = chunksOf(entries).map((chunk) => ({
      path: chunk.relativePath,
      symbol: chunk.symbolName,
      lines: `${chunk.startLine}-${chunk.endLine}`,
      chunkHash: chunk.chunkHash,
    }));
    expect({ decisions, chunks }).toMatchSnapshot();
  });

  it('records the expected reason for every excluded fixture', async () => {
    const entries = await collect(discovery, canonicalPath);
    const reasons = new Map(
      entries.flatMap((entry) =>
        entry.status === 'skipped'
          ? [[entry.relativePath, entry.reason] as const]
          : [],
      ),
    );
    expect(Object.fromEntries(reasons)).toMatchObject({
      '.git': 'excluded-path',
      'scripts/deploy.sh': 'secret-content',
      'config/settings.yaml': 'unsupported-extension',
      '.env': 'secret-filename',
      '.env.example': 'secret-filename',
      'config/credentials.json': 'secret-filename',
      'keys/server.pem': 'secret-filename',
      'keys/id_rsa': 'secret-filename',
      'package-lock.json': 'excluded-path',
      dist: 'excluded-path',
      build: 'excluded-path',
      coverage: 'excluded-path',
      node_modules: 'excluded-path',
      'public/app.min.js': 'excluded-path',
      'assets/logo.png': 'excluded-path',
      generated: 'gitignored',
      'packages/a/local.ts': 'gitignored',
      scratch: 'custom-exclusion',
      'notes.txt': 'unsupported-extension',
      'src/too-large.ts': 'too-large',
      'src/long-line.js': 'line-too-long',
      'src/invalid-encoding.ts': 'invalid-encoding',
      'src/config.ts': 'secret-content',
      'data/blob.json': 'binary',
      'linked-outside': 'symlink',
      'linked-inside': 'symlink',
    });
  });

  it('includes the expected files with language, size and hash of the raw bytes', async () => {
    const entries = await collect(discovery, canonicalPath);
    const included = entries.filter((entry) => entry.status === 'included');
    expect(included.map((entry) => entry.relativePath)).toEqual(
      expect.arrayContaining([
        'README.md',
        'src/math.ts',
        'src/view.tsx',
        'src/legacy.js',
        'lib/util.mjs',
        'lib/common.cjs',
        'src/broken.ts',
        'src/crlf.ts',
        'src/empty.ts',
        'packages/a/index.ts',
      ]),
    );
    const crlf = included.find((entry) => entry.relativePath === 'src/crlf.ts');
    expect(crlf).toMatchObject({
      language: 'typescript',
      text: 'export const a = 1;\nexport const b = 2;\n',
      sizeBytes: Buffer.byteLength(
        '\uFEFFexport const a = 1;\r\nexport const b = 2;\r\n',
      ),
      contentHash: sha256Hex(
        Buffer.from('\uFEFFexport const a = 1;\r\nexport const b = 2;\r\n'),
      ),
    });
  });

  it('is deterministic', async () => {
    const first = await collect(discovery, canonicalPath);
    const second = await collect(discovery, canonicalPath);
    expect(second).toEqual(first);
    expect(chunksOf(second)).toEqual(chunksOf(first));
  });

  it('visits entries in a stable ordinal order', async () => {
    const entries = await collect(discovery, canonicalPath);
    const topLevel = entries
      .map((entry) => entry.relativePath)
      .filter((path) => !path.includes('/'));
    expect(topLevel).toEqual([...topLevel].sort());
  });

  it('chunks reproduce the source and stay within the size limit', async () => {
    const entries = await collect(discovery, canonicalPath);
    for (const entry of entries) {
      if (entry.status !== 'included') continue;
      const chunks = chunking.chunk(entry);
      assertChunksCoverSource(entry.text, chunks);
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(400);
        expect(chunk.chunkHash).toBe(sha256Hex(chunk.content));
      }
    }
  });

  it('falls back to line chunks for malformed TypeScript and keeps symbols for valid files', async () => {
    const chunks = chunksOf(await collect(discovery, canonicalPath));
    const symbolsOf = (path: string) =>
      chunks
        .filter((chunk) => chunk.relativePath === path)
        .map((chunk) => chunk.symbolName);
    expect(symbolsOf('src/broken.ts')).toEqual([undefined]);
    expect(symbolsOf('src/math.ts')).toEqual(
      expect.arrayContaining(['add', 'multiply', 'Point', 'Axis', 'main']),
    );
    expect(symbolsOf('src/big-service.ts')).toEqual(
      expect.arrayContaining([
        'BigService',
        'BigService.method0',
        'BigService.method11',
      ]),
    );
  });

  describe('privacy', () => {
    it('never exposes the canary secret in entries or chunks', async () => {
      const entries = await collect(discovery, canonicalPath);
      assertNotLeaked(
        JSON.stringify({ entries, chunks: chunksOf(entries) }),
        CANARY_SECRET,
      );
    });

    it('never logs paths, content or secrets', async () => {
      const messages: unknown[] = [];
      for (const method of [
        'log',
        'warn',
        'error',
        'debug',
        'verbose',
      ] as const) {
        jest
          .spyOn(Logger.prototype, method)
          .mockImplementation((...args: unknown[]) => void messages.push(args));
      }
      await collect(discovery, canonicalPath);
      expect(messages).toHaveLength(1);
      const logged = JSON.stringify(messages);
      assertNotLeaked(logged, CANARY_SECRET, 'src/config.ts', canonicalPath);
      expect(logged).toMatch(
        /included=\d+ skipped=\d+ bytes=\d+ durationMs=\d+/,
      );
    });

    it('does not enter links that point outside or inside the repository', async () => {
      const paths = (await collect(discovery, canonicalPath)).map(
        (entry) => entry.relativePath,
      );
      expect(paths.filter((path) => path.startsWith('linked-'))).toEqual([
        'linked-inside',
        'linked-outside',
      ]);
      expect(paths.some((path) => path.endsWith('outside.ts'))).toBe(false);
    });
  });

  describe('root checks', () => {
    it('refuses a root that is reached through a link', async () => {
      const alias = join(box.root, 'sample-alias');
      linkDirectory(sample.path, alias);
      await expect(collect(discovery, alias)).rejects.toBeInstanceOf(
        RepositoryRootChangedError,
      );
    });

    it('refuses a root outside the allowed roots', async () => {
      const outside = makeGitRepository(box.outside, 'other');
      await expect(collect(discovery, outside)).rejects.toBeInstanceOf(
        PathRejectedError,
      );
    });

    it('fails without leaking the path when the root disappears', async () => {
      const missing = join(box.root, 'gone');
      jest
        .spyOn(PathPolicyService.prototype, 'resolve')
        .mockResolvedValue({ canonicalPath: missing, relativePath: 'gone' });
      const failure = await collect(discovery, missing).catch(
        (error: Error) => error,
      );
      expect(failure).toBeInstanceOf(RepositoryRootChangedError);
      expect((failure as Error).message).not.toContain('gone');
    });
  });

  describe('limits and edge cases', () => {
    it('stops indexing once the total byte budget is used', async () => {
      const limited = standaloneDiscovery({
        INGEST_MAX_FILE_BYTES: '1024',
        INGEST_MAX_TOTAL_BYTES: '2048',
      });
      const entries = await collect(limited, canonicalPath);
      const indexed = entries
        .filter((entry) => entry.status === 'included')
        .reduce((sum, entry) => sum + entry.sizeBytes, 0);
      expect(indexed).toBeLessThanOrEqual(2048);
      expect(
        entries.filter(
          (entry) =>
            entry.status === 'skipped' && entry.reason === 'total-size-limit',
        ).length,
      ).toBeGreaterThan(0);
    });

    it('honours a configured language list', async () => {
      const markdownOnly = standaloneDiscovery({
        INGEST_LANGUAGES: 'markdown',
      });
      const included = (await collect(markdownOnly, canonicalPath)).filter(
        (entry) => entry.status === 'included',
      );
      expect(included.map((entry) => entry.relativePath)).toEqual([
        'README.md',
      ]);
    });

    it('rejects an unknown language at startup', () => {
      expect(() =>
        standaloneDiscovery({ INGEST_LANGUAGES: 'markdown,cobol' }),
      ).toThrow(UnknownLanguageError);
    });

    it('indexes languages without symbol chunking as line chunks', async () => {
      const entries = await collect(discovery, canonicalPath);
      const included = entries.filter((entry) => entry.status === 'included');
      expect(
        included.map((entry) => [entry.relativePath, entry.language]),
      ).toEqual(
        expect.arrayContaining([
          ['app/main.py', 'python'],
          ['Dockerfile', 'dockerfile'],
          ['scripts/clean.sh', 'shell'],
        ]),
      );
      const python = chunksOf(entries).filter(
        (chunk) => chunk.relativePath === 'app/main.py',
      );
      expect(python).toMatchObject([
        { language: 'python', startLine: 1, endLine: 2 },
      ]);
      expect(python[0]).not.toHaveProperty('symbolName');
    });

    it('ignores an unreadable, oversized or invalid .gitignore', async () => {
      const repo = makeGitRepository(box.root, 'odd-gitignore');
      writeFiles(repo, {
        '.gitignore': 'x'.repeat(70 * 1024),
        'a.ts': 'export const a = 1;\n',
        'sub/.gitignore': new Uint8Array([0xc3, 0x28]),
        'sub/b.ts': 'export const b = 2;\n',
      });
      const resolved = await new PathPolicyService(configFor()).resolve(repo);
      const entries = await collect(discovery, resolved.canonicalPath);
      expect(
        entries
          .filter((entry) => entry.status === 'included')
          .map((entry) => entry.relativePath),
      ).toEqual(['a.ts', 'sub/b.ts']);
    });

    it('skips an empty repository without error', async () => {
      const repo = makeGitRepository(box.root, 'empty-repo');
      writeFileSync(join(repo, 'README.md'), '');
      const resolved = await new PathPolicyService(configFor()).resolve(repo);
      const entries = await collect(discovery, resolved.canonicalPath);
      expect(chunksOf(entries)).toEqual([]);
    });
  });
});
