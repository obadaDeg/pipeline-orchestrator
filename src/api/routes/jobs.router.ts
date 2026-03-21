import { Router } from 'express';
import { getDeliveryAttempts, getJob } from '../controllers/jobs.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const jobsRouter = Router();

jobsRouter.use(authenticate);

jobsRouter.get('/:id', getJob);
jobsRouter.get('/:id/delivery-attempts', getDeliveryAttempts);
