import type { EvidenceItem } from './evidence-item';

export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface GroundedAnswerInput<T extends EvidenceItem = EvidenceItem> {
  question: string;
  evidence: readonly T[];
  /** Oldest first; trimmed to the configured history budget. */
  history: readonly ConversationTurn[];
}

export interface FollowUpInput {
  question: string;
  /** Oldest first. */
  history: readonly ConversationTurn[];
}
