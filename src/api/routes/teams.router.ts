import { Router } from 'express';
import * as controller from '../controllers/teams.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-request.js';
import { AddMemberBodySchema, CreateTeamBodySchema } from '../schemas/team.schema.js';

export const teamsRouter = Router();

teamsRouter.use(authenticate);

teamsRouter.post('/', validateBody(CreateTeamBodySchema), controller.createTeamHandler);
teamsRouter.get('/:id', controller.getTeamHandler);
teamsRouter.delete('/:id', controller.deleteTeamHandler);
teamsRouter.post('/:id/members', validateBody(AddMemberBodySchema), controller.addMemberHandler);
teamsRouter.delete('/:id/members/:userId', controller.removeMemberHandler);
