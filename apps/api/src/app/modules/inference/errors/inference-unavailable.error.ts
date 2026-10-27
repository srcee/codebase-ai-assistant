export type InferenceFailureReason =
  | 'network'
  | 'timeout'
  | 'invalid-response'
  | 'server-error'
  | 'blocked';

const RETRYABLE: ReadonlySet<InferenceFailureReason> = new Set([
  'network',
  'timeout',
  'server-error',
]);

/** Carries a reason code only, never the address, request or response body. */
export class InferenceUnavailableError extends Error {
  constructor(readonly reason: InferenceFailureReason) {
    super(`Local inference is unavailable: ${reason}`);
    this.name = 'InferenceUnavailableError';
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.reason);
  }
}
