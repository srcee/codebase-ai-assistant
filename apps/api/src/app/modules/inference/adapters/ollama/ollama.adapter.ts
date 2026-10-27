import type { AppConfig } from '@codebase-ai/server-config';
import type { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import type { ChatMessage } from '../../types/chat-message';
import type { InferenceRequestOptions } from '../../types/inference-request-options';
import type { InferenceRuntimeAdapter } from '../../types/inference-runtime-adapter';
import { OllamaChat } from './ollama-chat';
import { OllamaEmbedding } from './ollama-embedding';
import { OllamaModels } from './ollama-models';

/** Plugs a local Ollama server into the app. The only export of this folder used outside it. */
export class OllamaAdapter implements InferenceRuntimeAdapter {
  private readonly embedding: OllamaEmbedding;
  private readonly chat: OllamaChat;
  private readonly models: OllamaModels;

  constructor(egress: EgressHttpClient, config: AppConfig) {
    this.embedding = new OllamaEmbedding(egress, config);
    this.chat = new OllamaChat(egress, config);
    this.models = new OllamaModels(egress);
  }

  embedBatch(
    texts: readonly string[],
    options?: InferenceRequestOptions,
  ): Promise<number[][]> {
    return this.embedding.embedBatch(texts, options);
  }

  complete(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): Promise<string> {
    return this.chat.complete(messages, options);
  }

  stream(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): AsyncIterable<string> {
    return this.chat.stream(messages, options);
  }

  availableModels(names: readonly string[]): Promise<boolean[]> {
    return this.models.availableModels(names);
  }
}
