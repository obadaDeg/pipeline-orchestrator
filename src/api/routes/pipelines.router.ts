import { Router } from 'express';
import { listPipelineJobs } from '../controllers/jobs.controller.js';
import * as controller from '../controllers/pipelines.controller.js';
import * as signingController from '../controllers/signing.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-request.js';
import { CreatePipelineBodySchema, UpdatePipelineBodySchema } from '../schemas/pipeline.schema.js';

export const pipelinesRouter = Router();

pipelinesRouter.use(authenticate);

pipelinesRouter.post('/', validateBody(CreatePipelineBodySchema), controller.createPipeline);
pipelinesRouter.get('/', controller.listPipelines);
pipelinesRouter.get('/:id', controller.getPipeline);
pipelinesRouter.patch('/:id', validateBody(UpdatePipelineBodySchema), controller.updatePipeline);
pipelinesRouter.delete('/:id', controller.deletePipeline);
pipelinesRouter.get('/:id/jobs', listPipelineJobs);

// Signing secret management (ownership enforced via existing pipeline ownership check)
pipelinesRouter.post('/:id/signing-secret', signingController.generateOrRotateHandler);
pipelinesRouter.get('/:id/signing-secret', signingController.getStatusHandler);
pipelinesRouter.delete('/:id/signing-secret', signingController.revokeHandler);
