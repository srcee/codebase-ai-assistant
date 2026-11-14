import type { Citation, MessageStatus } from '@codebase-ai/contracts';

export interface ExchangeRecord {
  conversationId: string;
  /** Set on a new conversation only. */
  projectId: string | null;
  question: string;
  askedAt: Date;
  answer: string;
  status: MessageStatus;
  citations: readonly Citation[];
}
