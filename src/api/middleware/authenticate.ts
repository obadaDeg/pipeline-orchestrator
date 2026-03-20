import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../lib/errors.js';
import { validateApiKey } from '../../services/auth.service.js';

/**
 * Authenticate a request via Bearer API key.
 * On success, attaches the resolved user to req.user and calls next().
 * On failure, calls next(UnauthorizedError) — never distinguishes between
 * "key not found" and "key revoked" to prevent credential enumeration.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid Authorization header'));
    return;
  }

  const rawKey = authHeader.slice(7);

  try {
    const user = await validateApiKey(rawKey);
    if (!user) {
      next(new UnauthorizedError('Invalid API key'));
      return;
    }
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError('Authentication failed'));
  }
}
