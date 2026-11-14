import type { EvidenceItem } from './evidence-item';

export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface GroundedAnswerInput {
  question: string;
  evidence: readonly EvidenceItem[];
  /** Oldest first; trimmed to the configured history budget. */
  history: readonly ConversationTurn[];
}
