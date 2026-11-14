import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import type { ChatMessage } from '../../inference/types/chat-message';
import { CHAT_PORT, type ChatPort } from '../../inference/types/chat-port';
import type { InferenceRequestOptions } from '../../inference/types/inference-request-options';
import type { GroundedAnswerInput } from '../types/grounded-answer-input';
import { buildGroundedPrompt } from '../utils/build-grounded-prompt';

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
}
