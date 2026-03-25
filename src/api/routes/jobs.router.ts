import { Router } from 'express';
import { getDeliveryAttempts, getJob, listJobs, retryJob } from '../controllers/jobs.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const jobsRouter = Router();

jobsRouter.use(authenticate);

jobsRouter.get('/', listJobs);
jobsRouter.get('/:id', getJob);
jobsRouter.get('/:id/delivery-attempts', getDeliveryAttempts);
jobsRouter.post('/:id/retry', retryJob);
