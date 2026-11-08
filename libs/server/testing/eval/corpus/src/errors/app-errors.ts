export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message, 422);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
