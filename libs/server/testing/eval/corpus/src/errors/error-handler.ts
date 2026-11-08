import { AppError, ValidationError } from './app-errors';

export interface HttpErrorResponse {
  status: number;
  body: { message: string; field?: string };
}

/** Turns any thrown value into a response; unknown errors never leak their message. */
export function toHttpResponse(error: unknown): HttpErrorResponse {
  if (error instanceof ValidationError) {
    return {
      status: error.statusCode,
      body: { message: error.message, field: error.field },
    };
  }
  if (error instanceof AppError) {
    return { status: error.statusCode, body: { message: error.message } };
  }
  return { status: 500, body: { message: 'Unexpected error' } };
}
