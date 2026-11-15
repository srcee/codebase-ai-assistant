import type { ChatMessage } from '../../types/chat-message';

export interface OllamaEmbedRequest {
  model: string;
  input: string[];
  truncate: false;
}

export interface OllamaEmbedResponse {
  embeddings?: unknown;
}

export interface OllamaChatRequest {
  model: string;
  messages: readonly ChatMessage[];
  stream: boolean;
  options: OllamaChatOptions;
}

// Without num_ctx Ollama uses its own default window and silently drops prompt text that does not fit.
export interface OllamaChatOptions {
  num_ctx: number;
  num_predict: number;
  temperature: number;
}

export interface OllamaChatResponse {
  message?: { content?: unknown };
  done?: boolean;
  error?: unknown;
}

export interface OllamaTagsResponse {
  models?: { name?: unknown; model?: unknown }[];
}
