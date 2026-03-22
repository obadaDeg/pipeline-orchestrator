import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../lib/response.js';
import * as signingService from '../../services/signing.service.js';

export async function generateOrRotateHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await signingService.createOrRotateSecret(req.params.id);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function getStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await signingService.getSecretStatus(req.params.id);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function revokeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await signingService.revokeSecret(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
