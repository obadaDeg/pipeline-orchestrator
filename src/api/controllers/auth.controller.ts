import { NextFunction, Request, Response } from 'express';
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
