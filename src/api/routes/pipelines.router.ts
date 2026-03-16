import { Router } from 'express';
import { listPipelineJobs } from '../controllers/jobs.controller.js';
import * as controller from '../controllers/pipelines.controller.js';
import { validateBody } from '../middleware/validate-request.js';
import { CreatePipelineBodySchema, UpdatePipelineBodySchema } from '../schemas/pipeline.schema.js';

export const pipelinesRouter = Router();

pipelinesRouter.post('/', validateBody(CreatePipelineBodySchema), controller.createPipeline);
pipelinesRouter.get('/', controller.listPipelines);
pipelinesRouter.get('/:id', controller.getPipeline);
pipelinesRouter.patch('/:id', validateBody(UpdatePipelineBodySchema), controller.updatePipeline);
pipelinesRouter.delete('/:id', controller.deletePipeline);
pipelinesRouter.get('/:id/jobs', listPipelineJobs);
