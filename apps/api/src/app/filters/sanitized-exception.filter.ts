import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseNotConfiguredError } from '@codebase-ai/server-database';
import { InferenceModelNotFoundError } from '../modules/inference/errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../modules/inference/errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../modules/inference/errors/inference-unavailable.error';

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

    if (exception instanceof DatabaseNotConfiguredError) {
      response
        .status(503)
        .json({ statusCode: 503, message: exception.message });
      return;
    }

    if (
      exception instanceof InferenceUnavailableError ||
      exception instanceof InferenceModelNotFoundError ||
      exception instanceof InferenceRequestRejectedError
    ) {
      response
        .status(503)
        .json({ statusCode: 503, message: exception.message });
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
