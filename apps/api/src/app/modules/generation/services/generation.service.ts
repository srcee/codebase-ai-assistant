import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import type { ChatMessage } from '../../inference/types/chat-message';
import { CHAT_PORT, type ChatPort } from '../../inference/types/chat-port';
import type { InferenceRequestOptions } from '../../inference/types/inference-request-options';
import type { EvidenceItem } from '../types/evidence-item';
import type {
  FollowUpInput,
  GroundedAnswerInput,
} from '../types/grounded-answer-input';
import {
  buildGroundedPrompt,
  trimHistory,
} from '../utils/build-grounded-prompt';
import { buildRewritePrompt } from '../utils/build-rewrite-prompt';
import { fitGroundedInput } from '../utils/fit-grounded-input';
import { sanitizeRewrite } from '../utils/sanitize-rewrite';

/** Runtime-agnostic generation entry point; the model is reached only through the chat port. */
@Injectable()
export class GenerationService {
  constructor(
    @Inject(CHAT_PORT) private readonly chat: ChatPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  complete(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): Promise<string> {
    return this.chat.complete(messages, options);
  }

  stream(
    messages: readonly ChatMessage[],
    options?: InferenceRequestOptions,
  ): AsyncIterable<string> {
    return this.chat.stream(messages, options);
  }

  /** Fits evidence and history to the model context window; cite numbers follow the returned order. */
  fitGroundedInput<T extends EvidenceItem>(
    input: GroundedAnswerInput<T>,
  ): GroundedAnswerInput<T> {
    const { contextTokens, maxAnswerTokens, historyTurns, historyMaxChars } =
      this.config.chat;
    return fitGroundedInput(input, {
      contextTokens,
      maxAnswerTokens,
      historyTurns,
      historyMaxChars,
    });
  }

  /** Streams an answer that may cite evidence as [n], numbered from 1 in the given order. */
  streamGroundedAnswer(
    input: GroundedAnswerInput,
    options?: InferenceRequestOptions,
  ): AsyncIterable<string> {
    const { historyTurns, historyMaxChars } = this.config.chat;
    const messages = buildGroundedPrompt(input, {
      maxTurns: historyTurns,
      maxChars: historyMaxChars,
    });
    return this.chat.stream(messages, options);
  }

  /** A standalone retrieval query for a follow-up; the question itself when there is no history or no usable output. */
  async rewriteFollowUp(
    input: FollowUpInput,
    options?: InferenceRequestOptions,
  ): Promise<string> {
    const { historyTurns, historyMaxChars } = this.config.chat;
    const history = trimHistory(input.history, {
      maxTurns: historyTurns,
      maxChars: historyMaxChars,
    });
    if (history.length === 0) return input.question;
    const output = await this.chat.complete(
      buildRewritePrompt({ question: input.question, history }),
      options,
    );
    return sanitizeRewrite(output) ?? input.question;
  }
}
