import { NotFoundException } from '@nestjs/common';

export class ConversationNotFoundError extends NotFoundException {
  constructor() {
    super('Conversation not found.');
    this.name = 'ConversationNotFoundError';
  }
}
