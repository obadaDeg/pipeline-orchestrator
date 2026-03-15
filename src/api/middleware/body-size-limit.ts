import { NextFunction, Request, Response } from 'express';
import { config } from '../../config.js';
import { PayloadTooLargeError } from '../../lib/errors.js';

// Extend Express Request to carry the raw webhook body
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

/**
 * Buffers the raw request body stream, enforcing MAX_PAYLOAD_BYTES.
 * Rejects early via Content-Length header when available, then verifies
 * the actual byte count as data arrives.
 * Sets req.rawBody on success for downstream handlers.
 *
 * Mount this BEFORE global body parsers (express.json / express.text)
 * on webhook routes so the stream is not already consumed.
 */
export function bodySizeLimit(req: Request, _res: Response, next: NextFunction): void {
  // Early rejection — avoid reading the body at all when Content-Length
  // already tells us it's too large
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined && parseInt(contentLength, 10) > config.MAX_PAYLOAD_BYTES) {
    next(new PayloadTooLargeError(config.MAX_PAYLOAD_BYTES));
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  let settled = false;

  function settle(err?: unknown): void {
    if (settled) return;
    settled = true;
    if (err) {
      next(err);
    } else {
      req.rawBody = Buffer.concat(chunks).toString('utf-8');
      next();
    }
  }

  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > config.MAX_PAYLOAD_BYTES) {
      req.destroy();
      settle(new PayloadTooLargeError(config.MAX_PAYLOAD_BYTES));
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => settle());
  req.on('error', (err: Error) => settle(err));
}
