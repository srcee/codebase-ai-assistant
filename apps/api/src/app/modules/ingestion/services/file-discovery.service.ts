import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  APP_CONFIG,
  type AppConfig,
  type IngestionConfig,
} from '@codebase-ai/server-config';
import { PathPolicyService } from '../../codebases/services/path-policy.service';
import { RepositoryRootChangedError } from '../errors/repository-root-changed.error';
import { UnknownLanguageError } from '../errors/unknown-language.error';
import { KNOWN_LANGUAGE_IDS } from '../constants/language-lookups';
import type { DiscoveryEntry, SkippedEntry } from '../types/discovery-entry';
import type { SkipReason } from '../types/skip-reason';
import { decodeUtf8 } from '../utils/decode-utf8';
import { detectLanguage } from '../utils/detect-language';
import {
  createGitignoreLayer,
  type GitignoreLayer,
} from '../utils/gitignore-layers';
import { inspectContent } from '../utils/inspect-content';
import { readRegularFile } from '../utils/read-regular-file';
import { sha256Hex } from '../utils/sha256-hex';
import { ExclusionPolicyService } from './exclusion-policy.service';

const GITIGNORE_MAX_BYTES = 64 * 1024;

interface WalkState {
  rootPath: string;
  indexedBytes: number;
}

const byName = (a: Dirent, b: Dirent): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

@Injectable()
export class FileDiscoveryService {
  private readonly logger = new Logger(FileDiscoveryService.name);
  private readonly limits: IngestionConfig;
  private readonly enabledLanguages: ReadonlySet<string>;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly pathPolicy: PathPolicyService,
    private readonly exclusions: ExclusionPolicyService,
  ) {
    this.limits = config.ingestion;
    const requested = config.ingestion.languages;
    const unknown = requested?.filter((id) => !KNOWN_LANGUAGE_IDS.has(id));
    if (unknown?.length) throw new UnknownLanguageError(unknown);
    this.enabledLanguages = requested ? new Set(requested) : KNOWN_LANGUAGE_IDS;
  }

  /**
   * Walks a repository in a stable order and yields one decision per file or excluded directory.
   * No link is ever followed; included files carry their decoded text, skipped entries carry only a reason.
   * Throws if the root no longer resolves to `canonicalPath`.
   */
  async *discover(canonicalPath: string): AsyncGenerator<DiscoveryEntry> {
    const resolved = await this.pathPolicy.resolve(canonicalPath);
    if (resolved.canonicalPath !== canonicalPath) {
      throw new RepositoryRootChangedError();
    }

    const state: WalkState = { rootPath: canonicalPath, indexedBytes: 0 };
    const started = Date.now();
    let included = 0;
    let skipped = 0;
    try {
      for await (const entry of this.walk('', [], state)) {
        if (entry.status === 'included') included++;
        else skipped++;
        yield entry;
      }
    } finally {
      this.logger.log(
        `Discovery finished: included=${included} skipped=${skipped} bytes=${state.indexedBytes} durationMs=${Date.now() - started}`,
      );
    }
  }

  private async *walk(
    relativeDir: string,
    parentLayers: readonly GitignoreLayer[],
    state: WalkState,
  ): AsyncGenerator<DiscoveryEntry> {
    const directory = this.absolute(state, relativeDir);
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      if (!relativeDir) throw new RepositoryRootChangedError();
      yield skipped(relativeDir, 'directory', 'unreadable');
      return;
    }
    entries.sort(byName);
    const layers = await this.withGitignore(
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
        else yield* this.walk(relativePath, layers, state);
      } else if (entry.isFile()) {
        yield await this.visitFile(relativePath, layers, state);
      } else {
        yield skipped(relativePath, 'file', 'unreadable');
      }
    }
  }

  private async visitFile(
    relativePath: string,
    layers: readonly GitignoreLayer[],
    state: WalkState,
  ): Promise<DiscoveryEntry> {
    const excluded = this.exclusions.reasonToExclude(
      relativePath,
      false,
      layers,
    );
    if (excluded) return skipped(relativePath, 'file', excluded);

    const language = detectLanguage(relativePath);
    if (!language || !this.enabledLanguages.has(language)) {
      return skipped(relativePath, 'file', 'unsupported-extension');
    }

    if (state.indexedBytes >= this.limits.maxTotalBytes) {
      return skipped(relativePath, 'file', 'total-size-limit');
    }
    const outcome = await readRegularFile(
      this.absolute(state, relativePath),
      this.limits.maxFileBytes,
    );
    if (outcome.kind !== 'read') {
      return skipped(relativePath, 'file', outcome.kind);
    }

    const { bytes } = outcome;
    if (state.indexedBytes + bytes.length > this.limits.maxTotalBytes) {
      return skipped(relativePath, 'file', 'total-size-limit');
    }
    const inspection = inspectContent(bytes, this.limits.chunkMaxChars);
    if (inspection.kind === 'skip') {
      return skipped(relativePath, 'file', inspection.reason);
    }

    state.indexedBytes += bytes.length;
    return {
      status: 'included',
      relativePath,
      language,
      sizeBytes: bytes.length,
      contentHash: sha256Hex(bytes),
      text: inspection.text,
    };
  }

  /** .gitignore is a hint only; an unreadable or oversized one is ignored. */
  private async withGitignore(
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

  private absolute(state: WalkState, relativePath: string): string {
    return relativePath
      ? join(state.rootPath, ...relativePath.split('/'))
      : state.rootPath;
  }
}

function skipped(
  relativePath: string,
  kind: SkippedEntry['kind'],
  reason: SkipReason,
): SkippedEntry {
  return { status: 'skipped', relativePath, kind, reason };
}
