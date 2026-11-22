import { Injectable } from '@nestjs/common';
import { DOCUMENT_CHUNKING_VERSIONS } from '../../document-ingestion/constants/chunking-versions';
import { DocumentParsingService } from '../../document-ingestion/services/document-parsing.service';
import type { DocumentFile } from '../../document-ingestion/types/document-entry';
import type { FileFacts } from '../types/file-facts';
import type { FileOutcome } from '../types/file-outcome';
import type { IndexContext } from '../types/index-context';
import { FileIndexerService } from './file-indexer.service';

/** Indexes one document: unchanged files are not read again, parse failures fail that file only. */
@Injectable()
export class DocumentIndexerService {
  constructor(
    private readonly files: FileIndexerService,
    private readonly parsing: DocumentParsingService,
  ) {}

  async indexDocument(
    context: IndexContext,
    file: DocumentFile,
  ): Promise<FileOutcome> {
    const facts: FileFacts = {
      relativePath: file.relativePath,
      contentHash: file.contentHash,
      sizeBytes: file.sizeBytes,
      language: file.format.id,
      chunkingVersion: DOCUMENT_CHUNKING_VERSIONS[file.format.id],
    };
    if (await this.files.isUnchanged(context, facts)) {
      return { kind: 'unchanged' };
    }
    const result = await this.parsing.parse(
      file.format,
      await file.load(),
      context.signal,
    );
    switch (result.kind) {
      case 'chunks':
        return this.files.storeChunks(context, facts, result.chunks);
      case 'skipped':
        return this.files.storeContentSkip(context, facts, result.reason);
      case 'failed':
        return this.files.storeFailure(context, facts, result.code);
    }
  }
}
