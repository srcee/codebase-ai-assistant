import { BadRequestException } from '@nestjs/common';

export class InvalidCursorError extends BadRequestException {
  constructor() {
    super('Invalid cursor.');
    this.name = 'InvalidCursorError';
  }
}
