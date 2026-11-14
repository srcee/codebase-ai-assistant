import { HttpException, HttpStatus } from '@nestjs/common';

export class ChatBusyError extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message:
          'Another answer is being generated. Wait for it to finish, then try again.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.name = 'ChatBusyError';
  }
}
