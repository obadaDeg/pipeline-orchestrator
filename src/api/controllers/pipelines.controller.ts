import { NextFunction, Request, Response } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { successResponse } from '../../lib/response.js';
import * as pipelineService from '../../services/pipeline.service.js';

export async function createPipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, actionType, actionConfig, subscriberUrls } = req.body;
    const pipeline = await pipelineService.createPipeline({ name, actionType, actionConfig, subscriberUrls });
    res.status(201).json(successResponse(pipeline));
  } catch (err) {
    next(err);
  }
}

export async function getPipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pipeline = await pipelineService.getPipelineById(req.params.id);
    res.status(200).json(successResponse(pipeline));
  } catch (err) {
    next(err);
  }
}

export async function listPipelines(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await pipelineService.listPipelines(page, limit);
    res.status(200).json(successResponse(paginatedResponse(result.items, result.total, page, limit)));
  } catch (err) {
    next(err);
  }
}

export async function updatePipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pipeline = await pipelineService.updatePipeline(req.params.id, req.body);
    res.status(200).json(successResponse(pipeline));
  } catch (err) {
    next(err);
  }
}

export async function deletePipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await pipelineService.deletePipeline(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
