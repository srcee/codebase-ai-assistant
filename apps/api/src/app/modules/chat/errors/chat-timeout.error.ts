import { ServiceUnavailableException } from '@nestjs/common';

export class ChatTimeoutError extends ServiceUnavailableException {
  constructor() {
    super(
      'The answer took longer than CHAT_GENERATION_TIMEOUT_MS allows and was stopped.',
    );
    this.name = 'ChatTimeoutError';
  }
}
