import type { ChatMessage } from './chat-message';
import type { InferenceRequestOptions } from './inference-request-options';

export const CHAT_PORT = Symbol('CHAT_PORT');

/** Never retries and never falls back to another runtime. */
export interface ChatPort {
  complete(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): Promise<string>;
  /** Yields text fragments in order; aborting or stopping iteration closes the connection. */
  stream(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): AsyncIterable<string>;
}
