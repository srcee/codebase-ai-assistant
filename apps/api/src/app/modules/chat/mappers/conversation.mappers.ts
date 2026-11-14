import type {
  Citation,
  ContentKind,
  ConversationSummary,
  MessageResponse,
  MessageRole,
  MessageStatus,
} from '@codebase-ai/contracts';
import type { schema } from '@codebase-ai/server-database';
import { locatorSchema } from '../../retrieval/utils/locator-schema';

type ConversationRow = typeof schema.conversations.$inferSelect;
type MessageRow = typeof schema.messages.$inferSelect;
type CitationRow = typeof schema.messageCitations.$inferSelect;

export function toConversationSummary(
  row: ConversationRow,
): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** CHECK constraints guard the text kinds. */
export function toStoredCitation(row: CitationRow): Citation {
  return {
    ordinal: row.ordinal,
    chunkId: row.chunkId,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    relativePath: row.relativePath,
    contentKind: row.contentKind as ContentKind,
    locator: locatorSchema.parse(row.locator),
  };
}

export function toMessageResponse(
  row: MessageRow,
  citations: readonly CitationRow[],
): MessageResponse {
  return {
    id: row.id,
    role: row.role as MessageRole,
    status: row.status as MessageStatus,
    content: row.content,
    citations: citations.map(toStoredCitation),
    createdAt: row.createdAt.toISOString(),
  };
}
