import { NextFunction, Request, Response } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { successResponse } from '../../lib/response.js';
import * as jobService from '../../services/job.service.js';

export async function getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.getJobById(req.params.id);
    res.status(200).json(successResponse(job));
  } catch (err) {
    next(err);
  }
}

export async function listPipelineJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await jobService.listJobsForPipeline(req.params.id, page, limit);
    res.status(200).json(successResponse(paginatedResponse(result.items, result.total, page, limit)));
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryAttempts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const attempts = await jobService.getDeliveryAttempts(req.params.id);
    res.status(200).json(successResponse({ items: attempts }));
  } catch (err) {
    next(err);
  }
}
