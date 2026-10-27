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
}

export interface OllamaChatResponse {
  message?: { content?: unknown };
  done?: boolean;
  error?: unknown;
}

export interface OllamaTagsResponse {
  models?: { name?: unknown; model?: unknown }[];
}
