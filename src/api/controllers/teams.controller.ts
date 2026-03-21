import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../lib/response.js';
import * as teamService from '../../services/team.service.js';

export async function createTeamHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const team = await teamService.createTeam(req.user!.id, req.body.name as string);
    res.status(201).json(successResponse(team));
  } catch (err) {
    next(err);
  }
}

export async function getTeamHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const team = await teamService.getTeam(req.params.id, req.user!.id);
    res.status(200).json(successResponse(team));
  } catch (err) {
    next(err);
  }
}

export async function deleteTeamHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.deleteTeam(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addMemberHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const member = await teamService.addMember(req.params.id, req.user!.id, req.body.email as string);
    res.status(201).json(successResponse(member));
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.removeMember(req.params.id, req.user!.id, req.params.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
