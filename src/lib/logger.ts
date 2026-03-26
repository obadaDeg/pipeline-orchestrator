type LogLevel = 'info' | 'warn' | 'error';

// ── ANSI colours ──────────────────────────────────────────────────────────────
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
};

const LEVEL_STYLE: Record<LogLevel, { colour: string; label: string }> = {
  info:  { colour: c.green,  label: 'INFO ' },
  warn:  { colour: c.yellow, label: 'WARN ' },
  error: { colour: c.red,    label: 'ERROR' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timestamp(): string {
  return c.dim + new Date().toISOString().replace('T', ' ').slice(0, 23) + c.reset;
}

function flattenMeta(meta: unknown, prefix = ''): string {
  if (meta === null || meta === undefined) return '';
  if (meta instanceof Error) return ` ${c.dim}error=${c.reset}${c.red}${meta.message}${c.reset}`;
  if (typeof meta !== 'object') return ` ${c.dim}value=${c.reset}${String(meta)}`;

  return Object.entries(meta as Record<string, unknown>)
    .map(([k, v]) => {
      const key = `${c.dim}${prefix}${k}=${c.reset}`;
      if (v === null || v === undefined) return `${key}${c.dim}null${c.reset}`;
      if (typeof v === 'object') return flattenMeta(v, `${prefix}${k}.`);
      const val = typeof v === 'number'
        ? `${c.cyan}${v}${c.reset}`
        : `${c.white}${v}${c.reset}`;
      return `${key}${val}`;
    })
    .join('  ');
}

// ── Core log function ─────────────────────────────────────────────────────────

const PRETTY = process.env['LOG_PRETTY'] === 'true' || process.env['NODE_ENV'] === 'development';

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (PRETTY) {
    const { colour, label } = LEVEL_STYLE[level];
    const metaStr = meta !== undefined ? `  ${flattenMeta(meta)}` : '';
    const line = `${timestamp()}  ${colour}${c.bold}${label}${c.reset}  ${c.bold}${message}${c.reset}${metaStr}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (meta !== undefined) {
      entry['meta'] = meta instanceof Error
        ? { message: meta.message, stack: meta.stack }
        : meta;
    }
    const output = JSON.stringify(entry);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const logger = {
  info(message: string, meta?: unknown): void  { log('info',  message, meta); },
  warn(message: string, meta?: unknown): void  { log('warn',  message, meta); },
  error(message: string, meta?: unknown): void { log('error', message, meta); },
};
