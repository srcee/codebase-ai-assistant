import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { SkippedEntry } from '../types/discovery-entry';
import type { SkipReason } from '../types/skip-reason';
import type { WalkEntry } from '../types/walk-entry';
import { decodeUtf8 } from '../utils/decode-utf8';
import {
  createGitignoreLayer,
  type GitignoreLayer,
} from '../utils/gitignore-layers';
import { readRegularFile } from '../utils/read-regular-file';
import { ExclusionPolicyService } from './exclusion-policy.service';

const GITIGNORE_MAX_BYTES = 64 * 1024;

const byName = (a: Dirent, b: Dirent): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/** Walks a source root for code and document ingestion with the same exclusion and secret-filename rules. */
@Injectable()
export class DirectoryWalkerService {
  constructor(private readonly exclusions: ExclusionPolicyService) {}

  /**
   * Yields files in a stable order and a skipped entry for every excluded file, excluded directory, and link.
   * No link is ever followed; `rootUnreadable` is thrown when the root itself cannot be listed.
   */
  walk(
    rootPath: string,
    rootUnreadable: () => Error,
  ): AsyncGenerator<WalkEntry> {
    return this.walkDirectory(rootPath, '', [], rootUnreadable);
  }

  private async *walkDirectory(
    rootPath: string,
    relativeDir: string,
    parentLayers: readonly GitignoreLayer[],
    rootUnreadable: () => Error,
  ): AsyncGenerator<WalkEntry> {
    const directory = absolute(rootPath, relativeDir);
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      if (!relativeDir) throw rootUnreadable();
      yield skipped(relativeDir, 'directory', 'unreadable');
      return;
    }
    entries.sort(byName);
    const layers = await withGitignore(
      directory,
      relativeDir,
      entries,
      parentLayers,
    );

    for (const entry of entries) {
      const relativePath = relativeDir
        ? `${relativeDir}/${entry.name}`
        : entry.name;

      if (entry.isSymbolicLink()) {
        yield skipped(relativePath, 'symlink', 'symlink');
      } else if (entry.isDirectory()) {
        const reason = this.exclusions.reasonToExclude(
          relativePath,
          true,
          layers,
        );
        if (reason) yield skipped(relativePath, 'directory', reason);
        else {
          yield* this.walkDirectory(
            rootPath,
            relativePath,
            layers,
            rootUnreadable,
          );
        }
      } else if (entry.isFile()) {
        const reason = this.exclusions.reasonToExclude(
          relativePath,
          false,
          layers,
        );
        yield reason
          ? skipped(relativePath, 'file', reason)
          : {
              status: 'found',
              relativePath,
              absolutePath: absolute(rootPath, relativePath),
            };
      } else {
        yield skipped(relativePath, 'file', 'unreadable');
      }
    }
  }
}

/** .gitignore is a hint only; an unreadable or oversized one is ignored. */
async function withGitignore(
  directory: string,
  relativeDir: string,
  entries: readonly Dirent[],
  parentLayers: readonly GitignoreLayer[],
): Promise<readonly GitignoreLayer[]> {
  const gitignore = entries.find(
    (entry) => entry.name === '.gitignore' && entry.isFile(),
  );
  if (!gitignore) return parentLayers;

  const outcome = await readRegularFile(
    join(directory, gitignore.name),
    GITIGNORE_MAX_BYTES,
  );
  const content =
    outcome.kind === 'read' ? decodeUtf8(outcome.bytes) : undefined;
  return content === undefined
    ? parentLayers
    : [...parentLayers, createGitignoreLayer(relativeDir, content)];
}

function absolute(rootPath: string, relativePath: string): string {
  return relativePath ? join(rootPath, ...relativePath.split('/')) : rootPath;
}

function skipped(
  relativePath: string,
  kind: SkippedEntry['kind'],
  reason: SkipReason,
): SkippedEntry {
  return { status: 'skipped', relativePath, kind, reason };
}
