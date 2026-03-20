import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate-request.js';
import { LoginBodySchema, RegisterBodySchema } from '../schemas/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterBodySchema), controller.registerHandler);
authRouter.post('/login', validateBody(LoginBodySchema), controller.loginHandler);
