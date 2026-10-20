import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Returns generic 500s and logs only the error class, since messages can contain source or secrets. */
@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const request = http.getRequest<Request>();
    const errorName = exception instanceof Error ? exception.name : 'Unknown';
    this.logger.error(`${request.method} ${request.path} failed: ${errorName}`);
    response
      .status(500)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
