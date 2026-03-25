import { Router } from 'express';
import { getStats } from '../controllers/stats.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const statsRouter = Router();

statsRouter.use(authenticate);

statsRouter.get('/', getStats);
