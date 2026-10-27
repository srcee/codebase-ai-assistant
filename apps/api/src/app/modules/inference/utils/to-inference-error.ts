import { EgressHttpError } from '../../privacy/errors/egress-http.error';
import { EgressUnavailableError } from '../../privacy/errors/egress-unavailable.error';
import { InferenceModelNotFoundError } from '../errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../errors/inference-unavailable.error';

/** Maps transport errors to inference errors; a 404 means an unknown model when `model` is given. Caller aborts pass through. */
export function toInferenceError(error: unknown, model?: string): unknown {
  if (error instanceof EgressHttpError) {
    if (error.status === 404 && model !== undefined) {
      return new InferenceModelNotFoundError(model);
    }
    return error.status >= 500
      ? new InferenceUnavailableError('server-error')
      : new InferenceRequestRejectedError(error.status);
  }
  if (error instanceof EgressUnavailableError) {
    return new InferenceUnavailableError(error.reason);
  }
  return error;
}
