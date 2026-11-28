import type { UploadSkipReason } from '@codebase-ai/contracts';
import type { ReceivedBlob } from '../../document-ingestion/types/received-blob';

export type ReceivedPart =
  | {
      kind: 'received';
      logicalPath: string;
      blob: ReceivedBlob;
      mediaType: string;
    }
  | { kind: 'skipped'; logicalPath: string; reason: UploadSkipReason };
