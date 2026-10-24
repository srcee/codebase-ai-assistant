import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Sandbox {
  /** Real path of the temporary directory. */
  path: string;
  /** Allowed repository root inside the sandbox; created on first use. */
  root: string;
  /** Sibling of `root`, for repositories that must stay out of reach. */
  outside: string;
  dispose(): void;
}

export function createSandbox(prefix = 'caa-test-'): Sandbox {
  const path = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
  return {
    path,
    root: join(path, 'root'),
    outside: join(path, 'outside'),
    dispose: () => rmSync(path, { recursive: true, force: true }),
  };
}

/** Creates `<parent>/<name>/.git` and returns the repository path. */
export function makeGitRepository(parent: string, name: string): string {
  const path = join(parent, name);
  mkdirSync(join(path, '.git'), { recursive: true });
  return path;
}

// Directory symlinks need elevation on Windows; junctions do not and are ignored elsewhere.
export function linkDirectory(target: string, path: string): void {
  symlinkSync(target, path, 'junction');
}
