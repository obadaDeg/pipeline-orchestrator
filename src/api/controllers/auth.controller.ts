import { NextFunction, Request, Response } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { successResponse } from '../../lib/response.js';
import * as authService from '../../services/auth.service.js';
import type { LoginBody, RegisterBody } from '../schemas/auth.schema.js';

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body as RegisterBody;
    const result = await authService.register(email, password);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body as LoginBody;
    const result = await authService.login(email, password);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function listKeysHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const keys = await authService.listApiKeys(req.user!.id);
    res.status(200).json(successResponse(keys));
  } catch (err) {
    next(err);
  }
}

export async function createKeyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.createApiKey(req.user!.id, req.body.name as string);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function revokeKeyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.revokeApiKey(req.user!.id, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await authService.getUserAuditLog(req.user!.id, page, limit);
    res.status(200).json(successResponse(paginatedResponse(result.items, result.total, page, limit)));
  } catch (err) {
    next(err);
  }
}
