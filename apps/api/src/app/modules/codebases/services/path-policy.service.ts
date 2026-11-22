import { lstat, realpath, stat } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import type { SourceKind } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import {
  hasTraversalSegment,
  isLocalAbsolutePath,
  normalizeCanonicalPath,
} from '../utils/normalize-path';
import { PathRejectedError } from '../errors/path-rejected.error';
import { relativeToAnyRoot } from '../utils/relative-within';

const realpathNative = promisify(realpath.native);
const statPath = promisify(stat);
const lstatPath = promisify(lstat);

export interface ResolvedSourcePath {
  canonicalPath: string;
  /** Forward-slash path relative to the matching allowed root. */
  relativePath: string;
}

/** Code repositories resolve against ALLOWED_REPO_ROOTS, document folders against ALLOWED_DOCUMENT_ROOTS. */
@Injectable()
export class PathPolicyService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Allowed roots that exist, resolved through symlinks; unusable roots are ignored. */
  async canonicalRoots(
    kind: SourceKind = 'code_repository',
  ): Promise<string[]> {
    const configured =
      kind === 'code_repository'
        ? this.config.allowedRepoRoots
        : this.config.allowedDocumentRoots;
    const roots = await Promise.all(
      configured.map((root) =>
        isLocalAbsolutePath(root)
          ? this.realPath(root)
          : Promise.resolve(undefined),
      ),
    );
    return roots.filter((root): root is string => root !== undefined);
  }

  async resolve(
    input: string,
    kind: SourceKind = 'code_repository',
  ): Promise<ResolvedSourcePath> {
    if (!isLocalAbsolutePath(input) || hasTraversalSegment(input)) {
      throw new PathRejectedError('invalid-path', kind);
    }

    // realpath resolves every symlink and junction, so containment is checked on the real target.
    const canonicalPath = await this.realPath(input);
    if (!canonicalPath) throw new PathRejectedError('not-found', kind);

    const relativePath = relativeToAnyRoot(
      await this.canonicalRoots(kind),
      canonicalPath,
    );
    if (relativePath === null) {
      throw new PathRejectedError('outside-allowed-roots', kind);
    }

    if (!(await this.isDirectory(canonicalPath))) {
      throw new PathRejectedError('not-a-directory', kind);
    }
    if (
      kind === 'code_repository' &&
      this.config.requireGitDirectory &&
      !(await this.hasGitDirectory(canonicalPath))
    ) {
      throw new PathRejectedError('not-a-git-repository', kind);
    }
    return { canonicalPath, relativePath };
  }

  private async realPath(path: string): Promise<string | undefined> {
    try {
      return normalizeCanonicalPath(await realpathNative(path));
    } catch {
      return undefined;
    }
  }

  private async isDirectory(path: string): Promise<boolean> {
    try {
      return (await statPath(path)).isDirectory();
    } catch {
      return false;
    }
  }

  private async hasGitDirectory(path: string): Promise<boolean> {
    try {
      // lstat so a symlinked .git is not followed out of the root.
      return (await lstatPath(join(path, '.git'))).isDirectory();
    } catch {
      return false;
    }
  }
}
