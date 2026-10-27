import type { InferenceRuntime } from '@codebase-ai/server-config';
import { OllamaAdapter } from '../adapters/ollama/ollama.adapter';
import type { InferenceRuntimeAdapterClass } from '../types/inference-runtime-adapter';

/** The only place outside an adapter folder that names a runtime. To add one, register its adapter here and its id in INFERENCE_RUNTIMES. */
export const RUNTIME_ADAPTERS: Record<
  InferenceRuntime,
  InferenceRuntimeAdapterClass
> = {
  ollama: OllamaAdapter,
};
