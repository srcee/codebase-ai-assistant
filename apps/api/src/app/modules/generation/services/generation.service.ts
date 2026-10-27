import { Inject, Injectable } from '@nestjs/common';
import type { ChatMessage } from '../../inference/types/chat-message';
import { CHAT_PORT, type ChatPort } from '../../inference/types/chat-port';
import type { InferenceRequestOptions } from '../../inference/types/inference-request-options';

/** Runtime-agnostic generation entry point; prompt construction joins it in Stage 8. */
@Injectable()
export class GenerationService {
  constructor(@Inject(CHAT_PORT) private readonly chat: ChatPort) {}

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
}
