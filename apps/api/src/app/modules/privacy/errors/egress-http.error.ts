/** The runtime answered with a non-2xx status; the response body is deliberately dropped. */
export class EgressHttpError extends Error {
  constructor(readonly status: number) {
    super(`Local runtime responded with HTTP ${status}`);
    this.name = 'EgressHttpError';
  }
}
