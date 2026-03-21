import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-request.js';
import { CreateApiKeyBodySchema, LoginBodySchema, RegisterBodySchema } from '../schemas/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterBodySchema), controller.registerHandler);
authRouter.post('/login', validateBody(LoginBodySchema), controller.loginHandler);

// Key management — all require authentication
authRouter.get('/keys', authenticate, controller.listKeysHandler);
authRouter.post('/keys', authenticate, validateBody(CreateApiKeyBodySchema), controller.createKeyHandler);
authRouter.delete('/keys/:id', authenticate, controller.revokeKeyHandler);

// Audit log
authRouter.get('/audit-log', authenticate, controller.getAuditLogHandler);
