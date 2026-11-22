import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import type { ChunkLimits } from '../../ingestion/types/line-range';
import type { DocumentFormat } from '../types/document-format';
import type { ParseResult } from '../types/parse-result';
import { handleParseRequest } from '../utils/handle-parse-request';
import { shouldParseInWorker } from '../utils/should-parse-in-worker';
import { ParsingPoolService } from './parsing-pool.service';

/** Parses small text documents in the API thread and everything else in the parsing pool. */
@Injectable()
export class DocumentParsingService {
  private readonly limits: ChunkLimits;
  private readonly inlineMaxBytes: number;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly pool: ParsingPoolService,
  ) {
    this.limits = {
      chunkMaxChars: config.ingestion.chunkMaxChars,
      chunkOverlapChars: config.ingestion.chunkOverlapChars,
    };
    this.inlineMaxBytes = config.parsing.inlineMaxBytes;
  }

  /** `bytes` may be transferred to a worker, so the caller must not use them afterwards. */
  async parse(
    format: DocumentFormat,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ): Promise<ParseResult> {
    const request = { format: format.id, bytes, limits: this.limits };
    return shouldParseInWorker(format, bytes.byteLength, this.inlineMaxBytes)
      ? this.pool.parse(request, signal)
      : handleParseRequest(request);
  }
}
