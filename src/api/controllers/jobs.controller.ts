import { NextFunction, Request, Response } from 'express';
import { paginatedResponse, parsePagination } from '../../lib/pagination.js';
import { successResponse } from '../../lib/response.js';
import * as jobService from '../../services/job.service.js';

export async function listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const pipelineId =
      typeof req.query.pipelineId === 'string' ? req.query.pipelineId : undefined;
    const result = await jobService.listJobs(req.user!.id, { page, limit, offset, pipelineId });
    res.status(200).json(successResponse(paginatedResponse(result.items, result.total, page, limit)));
  } catch (err) {
    next(err);
  }
}

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
    const { page, limit, offset } = parsePagination(req.query);
    const result = await jobService.getDeliveryAttempts(req.params.id, { limit, offset });
    res.status(200).json(successResponse(paginatedResponse(result.items, result.total, page, limit)));
  } catch (err) {
    next(err);
  }
}

export async function retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.retryJob(req.params.id, req.user!.id);
    res.status(200).json(successResponse(job));
  } catch (err) {
    next(err);
  }
}
