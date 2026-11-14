import type { ContentKind, Locator } from './locators';
import type { Page } from './pagination';

/** Send exactly one of `sourceIds` or `projectId`; the model comes from server config only. */
export interface ChatRequest {
  question: string;
  sourceIds?: string[];
  projectId?: string;
  conversationId?: string;
}

export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'complete' | 'abstained';

export interface Citation {
  /** The `[n]` used in the answer text. */
  ordinal: number;
  /** Null once the chunk was removed by re-indexing. */
  chunkId: string | null;
  sourceId: string;
  sourceName: string;
  relativePath: string;
  contentKind: ContentKind;
  locator: Locator;
}

export interface MessageResponse {
  id: string;
  role: MessageRole;
  status: MessageStatus;
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse extends ConversationSummary {
  /** Oldest first. */
  messages: Page<MessageResponse>;
}

/** Server-sent events of `POST /chat`, in order: meta, token*, then done or error. */
export interface ChatMetaEvent {
  conversationId: string;
}

export interface ChatTokenEvent {
  text: string;
}

export interface ChatDoneEvent {
  messageId: string;
  /** Final answer with invalid citation markers removed; replaces the streamed text. */
  answer: string;
  status: MessageStatus;
  citations: Citation[];
  /** Citation numbers the model used that did not match retrieved evidence. */
  invalidCitations: number[];
  /** Next steps, set when the answer abstained. */
  suggestions: string[];
}

export interface ChatErrorEvent {
  message: string;
}

export type ChatStreamEvent =
  | { event: 'meta'; data: ChatMetaEvent }
  | { event: 'token'; data: ChatTokenEvent }
  | { event: 'done'; data: ChatDoneEvent }
  | { event: 'error'; data: ChatErrorEvent };
