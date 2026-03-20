export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(422, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(limitBytes: number) {
    super(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${limitBytes} byte limit`);
    this.name = 'PayloadTooLargeError';
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message = 'Method not allowed') {
    super(405, 'METHOD_NOT_ALLOWED', message);
    this.name = 'MethodNotAllowedError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'InternalError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}
