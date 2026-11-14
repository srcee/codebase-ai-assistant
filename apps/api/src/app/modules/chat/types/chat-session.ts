import type { ChatStreamEvent } from '@codebase-ai/contracts';

/** Retrieval and the first token are done; events can be written once headers are sent. */
export interface ChatSession {
  conversationId: string;
  events(): AsyncGenerator<ChatStreamEvent>;
}
