// ─── ActionType Enum ──────────────────────────────────────────────────────────
// Values match the DB `action_type` postgres enum exactly

export enum ActionType {
  FIELD_EXTRACTOR = 'field_extractor',
  PAYLOAD_FILTER = 'payload_filter',
  HTTP_ENRICHER = 'http_enricher',
}

// ─── ActionConfig Discriminated Union ────────────────────────────────────────
// Mirrors the Zod schemas in pipeline.schema.ts but as plain TypeScript types

export type FieldExtractorConfig = {
  actionType: 'field_extractor';
  mapping: Record<string, string>;
};

export type PayloadFilterConfig = {
  actionType: 'payload_filter';
  field: string;
  operator: 'eq' | 'ne' | 'contains';
  value: unknown;
};

export type HttpEnricherConfig = {
  actionType: 'http_enricher';
  url: string;
  mergeKey?: string;
};

export type ActionConfig = FieldExtractorConfig | PayloadFilterConfig | HttpEnricherConfig;

// ─── ActionTransformer Interface ──────────────────────────────────────────────

export interface ActionTransformer {
  /**
   * Transform the incoming payload.
   * @returns transformed payload, or null to signal "no delivery needed" (filter no-match)
   * @throws on unrecoverable errors
   */
  execute(payload: unknown, config: ActionConfig): Promise<unknown | null>;
}
