import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { PathPolicyService } from '../../codebases/services/path-policy.service';
import { DirectoryWalkerService } from '../../ingestion/services/directory-walker.service';
import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import type { SkipReason } from '../../ingestion/types/skip-reason';
import type { FoundFile } from '../../ingestion/types/walk-entry';
import { readRegularFile } from '../../ingestion/utils/read-regular-file';
import { sha256Hex } from '../../ingestion/utils/sha256-hex';
import { CollectionRootChangedError } from '../errors/collection-root-changed.error';
import type { DocumentEntry } from '../types/document-entry';
import { documentFormatFor } from '../utils/document-format-for';

/** Finds the documents of a folder collection with the exclusion and secret-filename rules of code ingestion. */
@Injectable()
export class DocumentDiscoveryService {
  private readonly logger = new Logger(DocumentDiscoveryService.name);
  private readonly maxBytes: number;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly pathPolicy: PathPolicyService,
    private readonly walker: DirectoryWalkerService,
  ) {
    this.maxBytes = config.documents.maxBytes;
  }

  /**
   * Walks the folder in a stable order; supported files within DOCUMENT_MAX_BYTES are read once and hashed,
   * nothing is parsed. Throws if the folder no longer resolves to `canonicalPath` inside a document root.
   */
  async *discover(canonicalPath: string): AsyncGenerator<DocumentEntry> {
    const resolved = await this.pathPolicy.resolve(
      canonicalPath,
      'document_collection',
    );
    if (resolved.canonicalPath !== canonicalPath) {
      throw new CollectionRootChangedError();
    }

    const started = Date.now();
    let included = 0;
    let skipped = 0;
    try {
      for await (const found of this.walker.walk(
        canonicalPath,
        () => new CollectionRootChangedError(),
      )) {
        const entry =
          found.status === 'found' ? await this.visit(found) : found;
        if (entry.status === 'included') included++;
        else skipped++;
        yield entry;
      }
    } finally {
      this.logger.log(
        `Document discovery finished: included=${included} skipped=${skipped} durationMs=${Date.now() - started}`,
      );
    }
  }

  private async visit(file: FoundFile): Promise<DocumentEntry> {
    const format = documentFormatFor(file.relativePath);
    if (!format) return skipped(file.relativePath, 'unsupported-extension');
    const outcome = await readRegularFile(file.absolutePath, this.maxBytes);
    if (outcome.kind !== 'read')
      return skipped(file.relativePath, outcome.kind);
    const { bytes } = outcome;
    return {
      status: 'included',
      relativePath: file.relativePath,
      format,
      sizeBytes: bytes.length,
      contentHash: sha256Hex(bytes),
      load: async () => bytes,
    };
  }
}

function skipped(relativePath: string, reason: SkipReason): SkippedEntry {
  return { status: 'skipped', relativePath, kind: 'file', reason };
}
