import type { InferenceEndpoint } from '../types/inference-endpoint';
import { resolveLocalEndpoint } from '../utils/resolve-local-endpoint';

/** The only provider registry. A hosted provider is a separate, explicit scope change. */
export const INFERENCE_PROVIDERS: Record<
  'local',
  (baseUrl: string) => Promise<InferenceEndpoint>
> = {
  local: (baseUrl) => resolveLocalEndpoint(baseUrl),
};
