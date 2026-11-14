import { Body, Controller, Inject, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { InferenceModelNotFoundError } from '../../inference/errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../../inference/errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatBusyError } from '../errors/chat-busy.error';
import { ChatCancelledError } from '../errors/chat-cancelled.error';
import { ChatTimeoutError } from '../errors/chat-timeout.error';
import { ChatConcurrencyService } from '../services/chat-concurrency.service';
import { ChatService } from '../services/chat.service';
import { startEventStream, writeEvent } from '../utils/event-stream';

function streamErrorMessage(error: unknown, signal: AbortSignal): string {
  if (signal.reason instanceof ChatTimeoutError) return signal.reason.message;
  if (
    error instanceof InferenceUnavailableError ||
    error instanceof InferenceModelNotFoundError ||
    error instanceof InferenceRequestRejectedError
  ) {
    return 'Local inference stopped responding. Check that the inference runtime is running and the chat model is installed, then try again.';
  }
  return 'The answer could not be completed.';
}

/** Server-sent events over POST; the body carries the question, so EventSource GET does not fit. */
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chat: ChatService,
    private readonly concurrency: ChatConcurrencyService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post()
  async ask(
    @Body() body: ChatRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    const release = this.concurrency.tryAcquire();
    if (!release) throw new ChatBusyError();

    const abort = new AbortController();
    const timer = setTimeout(
      () => abort.abort(new ChatTimeoutError()),
      this.config.chat.generationTimeoutMs,
    );
    const onClose = (): void => {
      if (!response.writableEnded) abort.abort(new ChatCancelledError());
    };
    response.on('close', onClose);

    try {
      let session;
      try {
        session = await this.chat.open(body, abort.signal);
      } catch (error) {
        if (abort.signal.reason instanceof ChatCancelledError) return;
        throw abort.signal.reason instanceof ChatTimeoutError
          ? abort.signal.reason
          : error;
      }
      if (abort.signal.aborted) return;

      startEventStream(response);
      try {
        for await (const event of session.events()) {
          writeEvent(response, event);
        }
      } catch (error) {
        this.logger.warn(
          `chat stream failed: ${error instanceof Error ? error.name : 'Unknown'}`,
        );
        if (!response.destroyed) {
          writeEvent(response, {
            event: 'error',
            data: { message: streamErrorMessage(error, abort.signal) },
          });
        }
      }
      response.end();
    } finally {
      clearTimeout(timer);
      response.off('close', onClose);
      release();
    }
  }
}
