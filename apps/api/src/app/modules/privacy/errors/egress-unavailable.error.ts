export type EgressFailureReason =
  | 'network'
  | 'timeout'
  | 'invalid-response'
  | 'blocked';

/** Carries a reason code only, never the address, request or response body. */
export class EgressUnavailableError extends Error {
  constructor(readonly reason: EgressFailureReason) {
    super(`Local runtime request failed: ${reason}`);
    this.name = 'EgressUnavailableError';
  }
}
