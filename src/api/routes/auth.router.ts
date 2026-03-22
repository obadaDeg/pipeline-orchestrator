import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-request.js';
import { CreateApiKeyBodySchema, LoginBodySchema, RegisterBodySchema } from '../schemas/auth.schema.js';

export const authRouter = Router();

// Rate limiting — prevent credential stuffing on public auth endpoints
const isTestEnv = process.env.NODE_ENV === 'test';

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many registration attempts. Try again in 15 minutes.' } },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many login attempts. Try again in 15 minutes.' } },
});

authRouter.post('/register', registerLimiter, validateBody(RegisterBodySchema), controller.registerHandler);
authRouter.post('/login', loginLimiter, validateBody(LoginBodySchema), controller.loginHandler);

// Key management — all require authentication
authRouter.get('/keys', authenticate, controller.listKeysHandler);
authRouter.post('/keys', authenticate, validateBody(CreateApiKeyBodySchema), controller.createKeyHandler);
authRouter.delete('/keys/:id', authenticate, controller.revokeKeyHandler);

// Audit log
authRouter.get('/audit-log', authenticate, controller.getAuditLogHandler);
