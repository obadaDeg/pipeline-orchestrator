type BadgeVariant =
  | 'field_extractor'
  | 'payload_filter'
  | 'http_enricher'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'success'
  | 'failed'
  | string;

const BADGE_STYLES: Record<string, string> = {
  field_extractor: 'bg-blue-100 text-blue-700',
  payload_filter: 'bg-amber-100 text-amber-700',
  http_enricher: 'bg-violet-100 text-violet-700',
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  // uppercase variants from old API
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const BADGE_LABELS: Record<string, string> = {
  field_extractor: 'Field Extractor',
  payload_filter: 'Payload Filter',
  http_enricher: 'HTTP Enricher',
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  success: 'Success',
  failed: 'Failed',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

interface BadgeProps {
  variant?: BadgeVariant;
  /** @deprecated use variant */
  status?: string;
}

export function Badge({ variant, status }: BadgeProps) {
  const value = variant ?? status ?? '';
  const colorClass = BADGE_STYLES[value] ?? 'bg-gray-100 text-gray-700';
  const label = BADGE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
