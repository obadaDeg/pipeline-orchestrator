import { z } from 'zod';
import { PaginationQuerySchema } from './pipeline.schema.js';

export const JobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const PipelineJobsQuerySchema = PaginationQuerySchema;

export type JobIdParam = z.infer<typeof JobIdParamSchema>;
export type PipelineJobsQuery = z.infer<typeof PipelineJobsQuerySchema>;
