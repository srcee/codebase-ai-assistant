import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import {
  buildSampleDocuments,
  createSandbox,
  linkDirectory,
  testConfig,
} from '@codebase-ai/server-testing';
import { assertNotLeaked, CANARY_SECRET } from '@codebase-ai/shared-testing';
import { PathRejectedError } from '../codebases/errors/path-rejected.error';
import { PathPolicyService } from '../codebases/services/path-policy.service';
import { DirectoryWalkerService } from '../ingestion/services/directory-walker.service';
import { ExclusionPolicyService } from '../ingestion/services/exclusion-policy.service';
import { sha256Hex } from '../ingestion/utils/sha256-hex';
import { CollectionRootChangedError } from './errors/collection-root-changed.error';
import { DocumentDiscoveryService } from './services/document-discovery.service';
import type { DocumentEntry } from './types/document-entry';

describe('document discovery', () => {
  const box = createSandbox('caa-document-discovery-');
  let folder: string;

  const discoveryFor = (env: Record<string, string> = {}) => {
    const config = testConfig({ ALLOWED_DOCUMENT_ROOTS: box.root, ...env });
    return new DocumentDiscoveryService(
      config,
      new PathPolicyService(config),
      new DirectoryWalkerService(new ExclusionPolicyService(config)),
    );
  };

  const collect = async (
    service: DocumentDiscoveryService,
    path: string,
  ): Promise<DocumentEntry[]> => {
    const entries: DocumentEntry[] = [];
    for await (const entry of service.discover(path)) entries.push(entry);
    return entries;
  };

  beforeAll(() => {
    folder = buildSampleDocuments(box);
  });

  afterAll(() => box.dispose());

  it('includes supported documents and records a reason for everything else', async () => {
    const entries = await collect(discoveryFor(), folder);
    expect(
      entries.map((entry) =>
        entry.status === 'included'
          ? [entry.relativePath, entry.format.id]
          : [entry.relativePath, entry.reason],
      ),
    ).toEqual([
      ['.env', 'secret-filename'],
      ['.gitignore', 'unsupported-extension'],
      ['design/mockup.png', 'excluded-path'],
      ['drafts', 'gitignored'],
      ['node_modules', 'excluded-path'],
      ['notes/binary.txt', 'text'],
      ['notes/glossary.txt', 'text'],
      ['notes/leaked.md', 'markdown'],
      ['specs/matrix.xlsx', 'unsupported-extension'],
      ['specs/roles.md', 'markdown'],
      ['specs/workflows.md', 'markdown'],
    ]);
  });

  it('hashes the raw bytes and hands them over unparsed', async () => {
    const entries = await collect(discoveryFor(), folder);
    const roles = entries.find(
      (entry) => entry.relativePath === 'specs/roles.md',
    );
    if (roles?.status !== 'included') throw new Error('roles.md not included');
    const bytes = await roles.load();
    expect(roles.contentHash).toBe(sha256Hex(bytes));
    expect(roles.sizeBytes).toBe(bytes.byteLength);
  });

  it('skips a document above DOCUMENT_MAX_BYTES', async () => {
    writeFileSync(
      join(folder, 'specs', 'large.md'),
      `# Large\n\n${'x'.repeat(2048)}\n`,
    );
    const entries = await collect(
      discoveryFor({ DOCUMENT_MAX_BYTES: '1024' }),
      folder,
    );
    expect(entries).toContainEqual({
      status: 'skipped',
      relativePath: 'specs/large.md',
      kind: 'file',
      reason: 'too-large',
    });
  });

  it('rejects a folder outside the document roots and one that no longer resolves to its registered path', async () => {
    await expect(
      collect(discoveryFor({ ALLOWED_DOCUMENT_ROOTS: box.outside }), folder),
    ).rejects.toBeInstanceOf(PathRejectedError);

    const alias = join(box.root, 'alias');
    linkDirectory(folder, alias);
    await expect(collect(discoveryFor(), alias)).rejects.toBeInstanceOf(
      CollectionRootChangedError,
    );
  });

  it('never logs paths or content', async () => {
    const messages: unknown[] = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((...args: unknown[]) => void messages.push(args));
    await collect(discoveryFor(), folder);
    jest.restoreAllMocks();
    expect(messages).toHaveLength(1);
    assertNotLeaked(JSON.stringify(messages), CANARY_SECRET, folder);
    expect(JSON.stringify(messages)).not.toContain('roles');
  });
});
