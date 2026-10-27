/** A 4xx other than an unknown model, for example input longer than the model context. Not retried. */
export class InferenceRequestRejectedError extends Error {
  constructor(readonly status: number) {
    super(`Local inference rejected the request with HTTP ${status}`);
    this.name = 'InferenceRequestRejectedError';
  }
}
