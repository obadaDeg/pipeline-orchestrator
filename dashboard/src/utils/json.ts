export function safeParseJson(str: string): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export function formatJson(value: any): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') {
    return JSON.stringify(safeParseJson(value), null, 2);
  }
  return JSON.stringify(value, null, 2);
}
