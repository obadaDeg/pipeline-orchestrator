import { NextFunction, Request, Response } from 'express';
import { MethodNotAllowedError, RateLimitError } from '../../lib/errors.js';
import { successResponse } from '../../lib/response.js';
import { ingestWebhook } from '../../services/ingestion.service.js';

export async function receiveWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
    const timestampHeader = req.headers['x-webhook-timestamp'] as string | undefined;
    const result = await ingestWebhook(req.params.sourceId, req.rawBody ?? '', signatureHeader, timestampHeader);
    res.status(202).json(successResponse(result));
  } catch (err) {
    if (err instanceof RateLimitError) {
      res
        .status(429)
        .set('Retry-After', String(err.retryAfterSec))
        .json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
}

export function methodNotAllowed(_req: Request, _res: Response, next: NextFunction): void {
  next(new MethodNotAllowedError('Only POST is accepted on this endpoint'));
}
