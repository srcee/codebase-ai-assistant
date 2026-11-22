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
import type { FoundFile } from '../types/walk-entry';
import { detectLanguage } from '../utils/detect-language';
import { inspectContent } from '../utils/inspect-content';
import { readRegularFile } from '../utils/read-regular-file';
import { sha256Hex } from '../utils/sha256-hex';
import { DirectoryWalkerService } from './directory-walker.service';

interface WalkState {
  indexedBytes: number;
}

@Injectable()
export class FileDiscoveryService {
  private readonly logger = new Logger(FileDiscoveryService.name);
  private readonly limits: IngestionConfig;
  private readonly enabledLanguages: ReadonlySet<string>;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly pathPolicy: PathPolicyService,
    private readonly walker: DirectoryWalkerService,
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

    const state: WalkState = { indexedBytes: 0 };
    const started = Date.now();
    let included = 0;
    let skipped = 0;
    try {
      for await (const found of this.walker.walk(
        canonicalPath,
        () => new RepositoryRootChangedError(),
      )) {
        const entry =
          found.status === 'found' ? await this.visitFile(found, state) : found;
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

  private async visitFile(
    file: FoundFile,
    state: WalkState,
  ): Promise<DiscoveryEntry> {
    const { relativePath } = file;
    const language = detectLanguage(relativePath);
    if (!language || !this.enabledLanguages.has(language)) {
      return skipped(relativePath, 'file', 'unsupported-extension');
    }

    if (state.indexedBytes >= this.limits.maxTotalBytes) {
      return skipped(relativePath, 'file', 'total-size-limit');
    }
    const outcome = await readRegularFile(
      file.absolutePath,
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
}

function skipped(
  relativePath: string,
  kind: SkippedEntry['kind'],
  reason: SkipReason,
): SkippedEntry {
  return { status: 'skipped', relativePath, kind, reason };
}
