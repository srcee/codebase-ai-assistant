import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, sep } from 'node:path';
import {
  linkDirectory,
  makeGitRepository,
  createSandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { PathPolicyService } from './path-policy.service';
import { PathRejectedError } from '../errors/path-rejected.error';
import type { PathRejectionReason } from '../types/path-rejection-reason';

const itOnWindows = process.platform === 'win32' ? it : it.skip;

describe('PathPolicyService', () => {
  const box = createSandbox('caa-path-policy-');
  const { path: sandbox, root, outside } = box;

  const policy = (env: Record<string, string> = {}) =>
    new PathPolicyService(testConfig({ ALLOWED_REPO_ROOTS: root, ...env }));

  async function rejection(
    service: PathPolicyService,
    input: string,
  ): Promise<PathRejectedError> {
    try {
      await service.resolve(input);
    } catch (error) {
      expect(error).toBeInstanceOf(PathRejectedError);
      return error as PathRejectedError;
    }
    throw new Error(`expected ${input} to be rejected`);
  }

  async function expectRejected(
    input: string,
    reason: PathRejectionReason,
    service = policy(),
  ) {
    expect((await rejection(service, input)).reason).toBe(reason);
  }

  beforeAll(() => {
    makeGitRepository(root, 'repo');
    makeGitRepository(join(root, 'nested'), 'deep');
    mkdirSync(join(root, 'plain'), { recursive: true });
    mkdirSync(join(root, 'with-linked-git'), { recursive: true });
    makeGitRepository(outside, 'secret');
    makeGitRepository(sandbox, 'root-evil');
    writeFileSync(join(root, 'file.txt'), 'synthetic');
    linkDirectory(join(outside, 'secret'), join(root, 'escape'));
    linkDirectory(join(root, 'repo'), join(root, 'alias'));
    linkDirectory(
      join(outside, 'secret', '.git'),
      join(root, 'with-linked-git', '.git'),
    );
  });

  afterAll(() => box.dispose());

  it('accepts a git repository inside an allowed root', async () => {
    await expect(policy().resolve(join(root, 'repo'))).resolves.toEqual({
      canonicalPath: join(root, 'repo'),
      relativePath: 'repo',
    });
  });

  it('uses forward slashes for nested relative paths', async () => {
    const resolved = await policy().resolve(join(root, 'nested', 'deep'));
    expect(resolved.relativePath).toBe('nested/deep');
  });

  it('accepts the allowed root itself when it is a repository', async () => {
    mkdirSync(join(root, '.git'));
    try {
      const resolved = await policy().resolve(root);
      expect(resolved.relativePath).toBe('.');
    } finally {
      rmSync(join(root, '.git'), { recursive: true });
    }
  });

  it('ignores a trailing separator', async () => {
    const resolved = await policy().resolve(join(root, 'repo') + sep);
    expect(resolved.canonicalPath).toBe(join(root, 'repo'));
  });

  it('accepts any of several allowed roots', async () => {
    const service = policy({
      ALLOWED_REPO_ROOTS: [join(sandbox, 'unrelated'), root].join(delimiter),
    });
    await expect(service.resolve(join(root, 'repo'))).resolves.toBeDefined();
  });

  describe('traversal and root containment', () => {
    it('rejects .. segments even when they stay inside the root', async () => {
      await expectRejected(
        `${join(root, 'nested')}${sep}..${sep}repo`,
        'invalid-path',
      );
    });

    it('rejects .. segments that leave the root', async () => {
      await expectRejected(
        `${join(root, 'repo')}${sep}..${sep}..${sep}outside${sep}secret`,
        'invalid-path',
      );
    });

    it('rejects a path outside every allowed root', async () => {
      await expectRejected(join(outside, 'secret'), 'outside-allowed-roots');
    });

    it('rejects a sibling whose name only shares the root prefix', async () => {
      await expectRejected(join(sandbox, 'root-evil'), 'outside-allowed-roots');
    });

    it('rejects everything when no roots are configured', async () => {
      await expectRejected(
        join(root, 'repo'),
        'outside-allowed-roots',
        policy({ ALLOWED_REPO_ROOTS: '' }),
      );
    });

    it('ignores allowed roots that are relative or missing', async () => {
      const service = policy({
        ALLOWED_REPO_ROOTS: ['relative-root', join(sandbox, 'missing')].join(
          delimiter,
        ),
      });
      await expectRejected(
        join(root, 'repo'),
        'outside-allowed-roots',
        service,
      );
    });
  });

  describe('symlinks and junctions', () => {
    it('rejects a link inside the root that resolves outside it', async () => {
      await expectRejected(join(root, 'escape'), 'outside-allowed-roots');
    });

    it('rejects a path that passes through an escaping link', async () => {
      await expectRejected(
        join(root, 'escape', '.git'),
        'outside-allowed-roots',
      );
    });

    it('registers a link that resolves inside the root by its real path', async () => {
      const resolved = await policy().resolve(join(root, 'alias'));
      expect(resolved).toEqual({
        canonicalPath: join(root, 'repo'),
        relativePath: 'repo',
      });
    });

    it('rejects a .git entry that is a link', async () => {
      await expectRejected(
        join(root, 'with-linked-git'),
        'not-a-git-repository',
      );
    });
  });

  describe('target checks', () => {
    it('rejects a nonexistent path', async () => {
      await expectRejected(join(root, 'missing'), 'not-found');
    });

    it('rejects a file', async () => {
      await expectRejected(join(root, 'file.txt'), 'not-a-directory');
    });

    it('rejects a directory without .git by default', async () => {
      await expectRejected(join(root, 'plain'), 'not-a-git-repository');
    });

    it('accepts a directory without .git when the check is disabled', async () => {
      const service = policy({ REPO_REQUIRE_GIT_DIR: 'false' });
      await expect(service.resolve(join(root, 'plain'))).resolves.toEqual({
        canonicalPath: join(root, 'plain'),
        relativePath: 'plain',
      });
    });
  });

  describe('malformed input', () => {
    it.each([
      ['empty', () => ''],
      ['relative', () => 'repo'],
      ['dot-relative', () => `.${sep}repo`],
      ['NUL byte', () => `${join(root, 'repo')}\u0000`],
      ['newline', () => `${join(root, 'repo')}\n`],
      ['too long', () => join(root, 'x'.repeat(5000))],
      ['UNC share', () => '\\\\server\\share\\repo'],
      ['forward-slash UNC', () => '//server/share/repo'],
      ['extended-length', () => '\\\\?\\C:\\repo'],
      ['device namespace', () => '\\\\.\\C:\\repo'],
    ])('rejects %s paths', async (_name, input) => {
      await expectRejected(input(), 'invalid-path');
    });

    itOnWindows('rejects drive-relative and rooted paths', async () => {
      await expectRejected('C:repo', 'invalid-path');
      await expectRejected('\\repo', 'invalid-path');
    });

    itOnWindows('rejects alternate data stream syntax', async () => {
      await expectRejected(`${join(root, 'repo')}:stream`, 'invalid-path');
    });
  });

  describe('Windows path variants', () => {
    itOnWindows('treats separator and case variants as one path', async () => {
      const repo = join(root, 'repo');
      const variants = [
        repo.replace(/\\/g, '/'),
        repo.toLowerCase(),
        repo.toUpperCase(),
        repo.charAt(0).toLowerCase() + repo.slice(1),
        `${repo}\\`,
      ];
      const resolved = await Promise.all(
        variants.map((variant) => policy().resolve(variant)),
      );
      for (const result of resolved) {
        expect(result.canonicalPath).toBe(repo);
        expect(result.relativePath).toBe('repo');
      }
    });

    itOnWindows('compares allowed roots case-insensitively', async () => {
      const service = policy({ ALLOWED_REPO_ROOTS: root.toLowerCase() });
      await expect(service.resolve(join(root, 'repo'))).resolves.toBeDefined();
    });

    itOnWindows('upper-cases the drive letter of canonical paths', async () => {
      const resolved = await policy().resolve(
        join(root, 'repo').replace(/^[A-Z]/, (drive) => drive.toLowerCase()),
      );
      expect(resolved.canonicalPath).toMatch(/^[A-Z]:\\/);
    });
  });

  it('never includes the rejected path in the error message', async () => {
    const inputs = [
      join(outside, 'secret'),
      join(root, 'missing'),
      join(root, 'file.txt'),
      join(root, 'plain'),
      '\\\\server\\share\\repo',
    ];
    for (const input of inputs) {
      const error = await rejection(policy(), input);
      expect(error.message).not.toContain('secret');
      expect(error.message).not.toContain(sandbox);
      expect(error.message).not.toContain('server');
    }
  });

  it('gives missing and outside-root paths the same message', async () => {
    const missing = await rejection(policy(), join(root, 'missing'));
    const escaped = await rejection(policy(), join(outside, 'secret'));
    expect(missing.message).toBe(escaped.message);
  });
});
