import { z } from 'zod';

// ─── Individual Action Config Schemas ────────────────────────────────────────

const FieldExtractorConfigSchema = z.object({
  mapping: z.record(z.string(), z.string()),
});

const PayloadFilterConfigSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'ne', 'contains']),
  value: z.unknown(),
});

const HttpEnricherConfigSchema = z.object({
  url: z.string().url(),
  mergeKey: z.string().optional(),
});

// Discriminated union combining actionType + config — used for typed action dispatch
export const ActionConfigSchema = z.discriminatedUnion('actionType', [
  z.object({ actionType: z.literal('field_extractor'), ...FieldExtractorConfigSchema.shape }),
  z.object({ actionType: z.literal('payload_filter'), ...PayloadFilterConfigSchema.shape }),
  z.object({ actionType: z.literal('http_enricher'), ...HttpEnricherConfigSchema.shape }),
]);

// ─── Pipeline Body Schemas ────────────────────────────────────────────────────

const rateLimitPerMinuteField = z.number().int().min(1).max(1000).nullable().optional();

// Full discriminated union on the body ensures actionConfig matches actionType
export const CreatePipelineBodySchema = z.discriminatedUnion('actionType', [
  z.object({
    name: z.string().min(1),
    actionType: z.literal('field_extractor'),
    actionConfig: FieldExtractorConfigSchema,
    subscriberUrls: z.array(z.string().url()).default([]),
    teamId: z.string().uuid().optional(),
    rateLimitPerMinute: rateLimitPerMinuteField,
  }),
  z.object({
    name: z.string().min(1),
    actionType: z.literal('payload_filter'),
    actionConfig: PayloadFilterConfigSchema,
    subscriberUrls: z.array(z.string().url()).default([]),
    teamId: z.string().uuid().optional(),
    rateLimitPerMinute: rateLimitPerMinuteField,
  }),
  z.object({
    name: z.string().min(1),
    actionType: z.literal('http_enricher'),
    actionConfig: HttpEnricherConfigSchema,
    subscriberUrls: z.array(z.string().url()).default([]),
    teamId: z.string().uuid().optional(),
    rateLimitPerMinute: rateLimitPerMinuteField,
  }),
]);

// actionType cannot be changed after creation — validate config loosely on update
export const UpdatePipelineBodySchema = z.object({
  name: z.string().min(1).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  subscriberUrls: z.array(z.string().url()).optional(),
  rateLimitPerMinute: rateLimitPerMinuteField,
});

// ─── Pagination Schema ────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreatePipelineBody = z.infer<typeof CreatePipelineBodySchema>;
export type UpdatePipelineBody = z.infer<typeof UpdatePipelineBodySchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ─── Simulation Schema ────────────────────────────────────────────────────────

export const FireSimulationBodySchema = z.object({
  payload: z.record(z.unknown()),
});

export type FireSimulationBody = z.infer<typeof FireSimulationBodySchema>;
