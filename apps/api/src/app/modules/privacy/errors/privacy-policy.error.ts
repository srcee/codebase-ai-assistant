/** Reasons are fixed strings so the rejected URL is never echoed. */
export class PrivacyPolicyError extends Error {
  constructor(reason: string) {
    super(`Privacy policy violation: ${reason}`);
    this.name = 'PrivacyPolicyError';
  }
}
