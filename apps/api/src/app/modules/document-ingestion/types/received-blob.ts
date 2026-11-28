export interface ReceivedBlob {
  /** SHA-256 of the received bytes. */
  hash: string;
  sizeBytes: number;
  /** Absolute temp file under DATA_DIR; store or discard it. */
  tempPath: string;
}

export type ReceiveOutcome =
  | { kind: 'received'; blob: ReceivedBlob }
  | { kind: 'too-large' };
