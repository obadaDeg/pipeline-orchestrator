import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../lib/response.js';
import * as statsService from '../../services/stats.service.js';

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await statsService.getStats(req.user!.id);
    res.status(200).json(successResponse(stats));
  } catch (err) {
    next(err);
  }
}
