export const INFERENCE_ENDPOINT = Symbol('INFERENCE_ENDPOINT');

/** A policy-checked origin; `localhost` is already pinned to the loopback IP it resolved to. */
export interface InferenceEndpoint {
  origin: string;
}
