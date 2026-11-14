import { BadRequestException } from '@nestjs/common';

export class QuestionTooLongError extends BadRequestException {
  constructor(maxChars: number) {
    super(`The question must be at most ${maxChars} characters.`);
    this.name = 'QuestionTooLongError';
  }
}
