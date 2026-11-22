import type { ChunkLimits } from '../../ingestion/types/line-range';
import type { DocumentFormatId } from './document-format';

export interface ParseRequest {
  format: DocumentFormatId;
  /** Raw file bytes; transferred to a worker, so the sender must not use them afterwards. */
  bytes: Uint8Array;
  limits: ChunkLimits;
}
