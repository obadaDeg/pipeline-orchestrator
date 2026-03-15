import { NextFunction, Request, Response } from 'express';
import { MethodNotAllowedError } from '../../lib/errors.js';
import { successResponse } from '../../lib/response.js';
import { ingestWebhook } from '../../services/ingestion.service.js';

export async function receiveWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await ingestWebhook(req.params.sourceId, req.rawBody ?? '');
    res.status(202).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export function methodNotAllowed(_req: Request, _res: Response, next: NextFunction): void {
  next(new MethodNotAllowedError('Only POST is accepted on this endpoint'));
}
