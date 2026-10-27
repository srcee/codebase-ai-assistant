import type { AppConfig } from '@codebase-ai/server-config';
import type { EgressHttpClient } from '../../privacy/services/egress-http-client.service';
import type { ChatPort } from './chat-port';
import type { EmbeddingPort } from './embedding-port';
import type { RuntimeHealthPort } from './runtime-health-port';

export const INFERENCE_RUNTIME_ADAPTER = Symbol('INFERENCE_RUNTIME_ADAPTER');

/** Everything one runtime must provide to plug into the app. */
export type InferenceRuntimeAdapter = EmbeddingPort &
  ChatPort &
  RuntimeHealthPort;

/** Adapters receive only the policy-checked egress client and config, so they cannot open their own connections. */
export type InferenceRuntimeAdapterClass = new (
  egress: EgressHttpClient,
  config: AppConfig,
) => InferenceRuntimeAdapter;
