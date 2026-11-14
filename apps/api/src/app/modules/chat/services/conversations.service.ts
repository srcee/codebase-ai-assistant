import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type {
  ConversationResponse,
  ConversationSummary,
  Page,
  PageQuery,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { ConversationTurn } from '../../generation/types/grounded-answer-input';
import { DEFAULT_PAGE_SIZE } from '../dto/page-query.dto';
import { ConversationNotFoundError } from '../errors/conversation-not-found.error';
import {
  toConversationSummary,
  toMessageResponse,
} from '../mappers/conversation.mappers';
import type { ExchangeRecord } from '../types/exchange-record';
import { decodeCursor, encodeCursor } from '../utils/page-cursor';

const { conversations, messages, messageCitations } = schema;

const TITLE_MAX_CHARS = 80;

const titleOf = (question: string): string => {
  const line = question.replace(/\s+/g, ' ').trim();
  return line.length > TITLE_MAX_CHARS
    ? `${line.slice(0, TITLE_MAX_CHARS - 1)}…`
    : line;
};

/** Timestamps are set here in milliseconds so cursors, which hold milliseconds, compare exactly. */
@Injectable()
export class ConversationsService {
  constructor(private readonly database: DatabaseService) {}

  /** Newest turns last; throws when the conversation does not exist. */
  async recentTurns(
    conversationId: string,
    maxTurns: number,
  ): Promise<ConversationTurn[]> {
    await this.requireConversation(conversationId);
    if (maxTurns === 0) return [];
    const rows = await this.database.db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(maxTurns * 2);

    const turns: ConversationTurn[] = [];
    const ordered = rows.reverse();
    ordered.forEach((row, index) => {
      const next = ordered[index + 1];
      if (row.role === 'user' && next?.role === 'assistant') {
        turns.push({ question: row.content, answer: next.content });
      }
    });
    return turns;
  }

  /** One transaction; a conversation deleted meanwhile is created again. */
  async saveExchange(record: ExchangeRecord): Promise<string> {
    const answeredAt = new Date(
      Math.max(Date.now(), record.askedAt.getTime() + 1),
    );
    return this.database.db.transaction(async (tx) => {
      await tx
        .insert(conversations)
        .values({
          id: record.conversationId,
          projectId: record.projectId,
          title: titleOf(record.question),
          createdAt: record.askedAt,
          updatedAt: answeredAt,
        })
        .onConflictDoUpdate({
          target: conversations.id,
          set: { updatedAt: answeredAt },
        });
      await tx.insert(messages).values({
        conversationId: record.conversationId,
        role: 'user',
        content: record.question,
        createdAt: record.askedAt,
      });
      const [assistant] = await tx
        .insert(messages)
        .values({
          conversationId: record.conversationId,
          role: 'assistant',
          status: record.status,
          content: record.answer,
          createdAt: answeredAt,
        })
        .returning({ id: messages.id });
      if (record.citations.length > 0) {
        await tx.insert(messageCitations).values(
          record.citations.map((citation) => ({
            messageId: assistant.id,
            ordinal: citation.ordinal,
            chunkId: citation.chunkId,
            sourceId: citation.sourceId,
            sourceName: citation.sourceName,
            relativePath: citation.relativePath,
            contentKind: citation.contentKind,
            locator: citation.locator,
          })),
        );
      }
      return assistant.id;
    });
  }

  /** Most recently updated first. */
  async list(query: PageQuery): Promise<Page<ConversationSummary>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const cursor =
      query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const rows = await this.database.db
      .select()
      .from(conversations)
      .where(
        cursor &&
          sql`(${conversations.updatedAt}, ${conversations.id}) < (${cursor.at.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      )
      .orderBy(desc(conversations.updatedAt), desc(conversations.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toConversationSummary),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ at: last.updatedAt, id: last.id })
          : null,
    };
  }

  /** Messages oldest first, paged with the same query. */
  async get(id: string, query: PageQuery): Promise<ConversationResponse> {
    const conversation = await this.requireConversation(id);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const cursor =
      query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const rows = await this.database.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, id),
          cursor &&
            sql`(${messages.createdAt}, ${messages.id}) > (${cursor.at.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
        ),
      )
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);

    const citations =
      page.length === 0
        ? []
        : await this.database.db
            .select()
            .from(messageCitations)
            .where(
              inArray(
                messageCitations.messageId,
                page.map((row) => row.id),
              ),
            )
            .orderBy(asc(messageCitations.ordinal));

    const last = page[page.length - 1];
    return {
      ...toConversationSummary(conversation),
      messages: {
        items: page.map((row) =>
          toMessageResponse(
            row,
            citations.filter((citation) => citation.messageId === row.id),
          ),
        ),
        nextCursor:
          rows.length > limit && last
            ? encodeCursor({ at: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  /** Messages and citations go with it through cascading foreign keys in the same statement. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });
    if (deleted.length === 0) throw new ConversationNotFoundError();
  }

  async purgeUpdatedBefore(cutoff: Date): Promise<number> {
    const deleted = await this.database.db
      .delete(conversations)
      .where(lt(conversations.updatedAt, cutoff))
      .returning({ id: conversations.id });
    return deleted.length;
  }

  private async requireConversation(id: string) {
    const [row] = await this.database.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!row) throw new ConversationNotFoundError();
    return row;
  }
}
