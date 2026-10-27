import { EgressHttpError } from '../../privacy/errors/egress-http.error';
import { EgressUnavailableError } from '../../privacy/errors/egress-unavailable.error';
import { InferenceModelNotFoundError } from '../errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../errors/inference-unavailable.error';
import { toInferenceError } from './to-inference-error';

describe('toInferenceError', () => {
  it('maps 404 to a missing model when a model is given', () => {
    expect(toInferenceError(new EgressHttpError(404), 'm')).toEqual(
      new InferenceModelNotFoundError('m'),
    );
  });

  it('maps 404 without a model to a rejected request', () => {
    expect(toInferenceError(new EgressHttpError(404))).toBeInstanceOf(
      InferenceRequestRejectedError,
    );
  });

  it.each([500, 502, 503])('maps %s to a retryable server error', (status) => {
    const mapped = toInferenceError(new EgressHttpError(status));
    expect(mapped).toBeInstanceOf(InferenceUnavailableError);
    expect(mapped).toMatchObject({ reason: 'server-error', retryable: true });
  });

  it.each([
    ['network', true],
    ['timeout', true],
    ['invalid-response', false],
    ['blocked', false],
  ] as const)('keeps the %s reason (retryable: %s)', (reason, retryable) => {
    expect(toInferenceError(new EgressUnavailableError(reason))).toMatchObject({
      name: 'InferenceUnavailableError',
      reason,
      retryable,
    });
  });

  it('passes other errors, such as a caller abort, through unchanged', () => {
    const abort = new DOMException('aborted', 'AbortError');
    expect(toInferenceError(abort)).toBe(abort);
  });
});
