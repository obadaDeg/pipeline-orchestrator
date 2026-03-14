type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, meta?: unknown): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (meta !== undefined) {
    entry.meta = meta;
  }
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info(message: string, meta?: unknown): void {
    log('info', message, meta);
  },
  warn(message: string, meta?: unknown): void {
    log('warn', message, meta);
  },
  error(message: string, meta?: unknown): void {
    log('error', message, meta);
  },
};
