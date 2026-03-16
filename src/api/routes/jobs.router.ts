import { Router } from 'express';
import { getDeliveryAttempts, getJob } from '../controllers/jobs.controller.js';

export const jobsRouter = Router();

jobsRouter.get('/:id', getJob);
jobsRouter.get('/:id/delivery-attempts', getDeliveryAttempts);
