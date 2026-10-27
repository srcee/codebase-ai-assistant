export interface EgressRequestOptions {
  /** Whole-request limit for JSON calls; idle limit between chunks for streams. Defaults to INFERENCE_TIMEOUT_MS. */
  timeoutMs?: number;
  signal?: AbortSignal;
}
