import { fieldExtractorAction } from './field-extractor.action.js';
import { httpEnricherAction } from './http-enricher.action.js';
import { payloadFilterAction } from './payload-filter.action.js';
import { ActionTransformer, ActionType } from './types.js';

export const ACTION_REGISTRY: Record<ActionType, ActionTransformer> = {
  [ActionType.FIELD_EXTRACTOR]: fieldExtractorAction,
  [ActionType.PAYLOAD_FILTER]: payloadFilterAction,
  [ActionType.HTTP_ENRICHER]: httpEnricherAction,
};

export function getAction(type: ActionType): ActionTransformer {
  const action = ACTION_REGISTRY[type];
  if (!action) throw new Error(`Unknown action type: ${type}`);
  return action;
}
