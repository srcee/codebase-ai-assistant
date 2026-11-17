import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ChatDoneEvent,
  ChatStreamEvent,
  MessageStatus,
} from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { GenerationService } from '../../generation/services/generation.service';
import {
  extractCitationNumbers,
  filterCitationNumbers,
} from '../../generation/utils/citation-markers';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { SearchScopeService } from '../../retrieval/services/search-scope.service';
import type { RetrievedChunk } from '../../retrieval/types/retrieved-chunk';
import {
  ABSTENTION_ANSWER,
  ABSTENTION_SUGGESTIONS,
  UNSUPPORTED_SUGGESTIONS,
} from '../constants/abstention';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { QuestionTooLongError } from '../errors/question-too-long.error';
import type { ChatSession } from '../types/chat-session';
import { shouldAbstain } from '../utils/should-abstain';
import { CitationValidatorService } from './citation-validator.service';
import { ConversationsService } from './conversations.service';

interface Exchange {
  conversationId: string;
  projectId: string | null;
  question: string;
  askedAt: Date;
  sourceIds: string[];
  started: bigint;
  rewritten: boolean;
  droppedEvidence: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly scope: SearchScopeService,
    private readonly retrieval: RetrievalService,
    private readonly generation: GenerationService,
    private readonly citations: CitationValidatorService,
    private readonly conversations: ConversationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Throws before any event, so failures up to the first token become normal HTTP errors. */
  async open(
    request: ChatRequestDto,
    signal: AbortSignal,
  ): Promise<ChatSession> {
    const {
      maxQuestionChars,
      historyTurns,
      minVectorSimilarity,
      minTermCoverage,
      rewriteFollowUps,
    } = this.config.chat;
    if (request.question.length > maxQuestionChars) {
      throw new QuestionTooLongError(maxQuestionChars);
    }
    const exchange: Exchange = {
      conversationId: request.conversationId ?? randomUUID(),
      projectId: request.projectId ?? null,
      question: request.question,
      askedAt: new Date(),
      sourceIds: await this.scope.resolve(request),
      started: process.hrtime.bigint(),
      rewritten: false,
      droppedEvidence: 0,
    };
    const history = request.conversationId
      ? await this.conversations.recentTurns(
          request.conversationId,
          historyTurns,
        )
      : [];

    // Only retrieval sees the rewritten query; the model answers the question as asked.
    const query =
      rewriteFollowUps && history.length > 0
        ? await this.generation.rewriteFollowUp(
            { question: exchange.question, history },
            { signal },
          )
        : exchange.question;
    exchange.rewritten = query !== exchange.question;

    const retrieved = await this.retrieval.search(
      { query, sourceIds: exchange.sourceIds },
      { signal },
    );
    const fitted = this.generation.fitGroundedInput({
      question: exchange.question,
      evidence: retrieved,
      history,
    });
    exchange.droppedEvidence = retrieved.length - fitted.evidence.length;
    if (
      fitted.evidence.length === 0 ||
      shouldAbstain(retrieved, query, { minVectorSimilarity, minTermCoverage })
    ) {
      return {
        conversationId: exchange.conversationId,
        events: () => this.abstentionEvents(exchange, retrieved.length),
      };
    }

    const fragments = this.generation
      .streamGroundedAnswer(fitted, { signal })
      [Symbol.asyncIterator]();
    const first = await fragments.next();
    return {
      conversationId: exchange.conversationId,
      events: () =>
        this.answerEvents(exchange, fitted.evidence, first, fragments),
    };
  }

  private async *abstentionEvents(
    exchange: Exchange,
    evidenceCount: number,
  ): AsyncGenerator<ChatStreamEvent> {
    yield { event: 'meta', data: { conversationId: exchange.conversationId } };
    const messageId = await this.conversations.saveExchange({
      ...exchange,
      answer: ABSTENTION_ANSWER,
      status: 'abstained',
      citations: [],
    });
    this.logResult(exchange, evidenceCount, 'abstained', 0, 0);
    yield {
      event: 'done',
      data: {
        messageId,
        answer: ABSTENTION_ANSWER,
        status: 'abstained',
        citations: [],
        invalidCitations: [],
        suggestions: [...ABSTENTION_SUGGESTIONS],
      },
    };
  }

  private async *answerEvents(
    exchange: Exchange,
    evidence: readonly RetrievedChunk[],
    first: IteratorResult<string>,
    fragments: AsyncIterator<string>,
  ): AsyncGenerator<ChatStreamEvent> {
    let finished = false;
    try {
      yield {
        event: 'meta',
        data: { conversationId: exchange.conversationId },
      };
      let answer = '';
      for (let next = first; !next.done; next = await fragments.next()) {
        answer += next.value;
        yield { event: 'token', data: { text: next.value } };
      }
      finished = true;
      yield {
        event: 'done',
        data: await this.finish(exchange, evidence, answer),
      };
    } finally {
      if (!finished) await fragments.return?.();
    }
  }

  private async finish(
    exchange: Exchange,
    evidence: readonly RetrievedChunk[],
    rawAnswer: string,
  ): Promise<ChatDoneEvent> {
    const used = extractCitationNumbers(rawAnswer);
    const citations = await this.citations.validate(
      used,
      evidence,
      exchange.sourceIds,
    );
    const valid = new Set(citations.map((citation) => citation.ordinal));
    const invalidCitations = used.filter((n) => !valid.has(n));
    const answer = filterCitationNumbers(rawAnswer, (n) => valid.has(n)).trim();
    const status: MessageStatus =
      citations.length > 0 ? 'complete' : 'unsupported';

    const messageId = await this.conversations.saveExchange({
      ...exchange,
      answer,
      status,
      citations,
    });
    this.logResult(
      exchange,
      evidence.length,
      status,
      citations.length,
      invalidCitations.length,
    );
    return {
      messageId,
      answer,
      status,
      citations,
      invalidCitations,
      suggestions: status === 'unsupported' ? [...UNSUPPORTED_SUGGESTIONS] : [],
    };
  }

  // Counts and timing only: questions, rewritten queries, and answers can hold source code.
  private logResult(
    exchange: Exchange,
    evidence: number,
    status: MessageStatus,
    validCitations: number,
    invalidCitations: number,
  ): void {
    const durationMs = Math.round(
      Number(process.hrtime.bigint() - exchange.started) / 1e6,
    );
    this.logger.log(
      `chat conversation=${exchange.conversationId} sources=${exchange.sourceIds.length} rewritten=${exchange.rewritten} evidence=${evidence} dropped=${exchange.droppedEvidence} status=${status} citations=${validCitations} invalidCitations=${invalidCitations} ${durationMs}ms`,
    );
  }
}
