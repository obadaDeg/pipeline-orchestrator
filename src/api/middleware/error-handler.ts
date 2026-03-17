import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { errorResponse } from '../../lib/response.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.error(err.message, { code: err.code, statusCode: err.statusCode, stack: err.stack });
    res.status(err.statusCode).json(errorResponse(err.code, err.message));
    return;
  }

  logger.error(
    'Unhandled error',
    err instanceof Error ? { message: err.message, stack: err.stack } : { error: String(err) },
  );
  res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
}
