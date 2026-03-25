/**
 * Demo Subscriber Server
 *
 * A lightweight HTTP server that acts as a downstream subscriber.
 * Receives processed webhook deliveries from the Pipeline Orchestrator,
 * verifies the X-Delivery-Signature (if a secret is configured),
 * and pretty-prints each delivery to the terminal.
 *
 * Usage:
 *   SUBSCRIBER_SECRET=<your-secret> node examples/subscriber-server/index.mjs
 *
 * The server listens on :5050 by default. Set PORT to override.
 */

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT ?? 5050;
const SECRET = process.env.SUBSCRIBER_SECRET ?? null;
const DELIVERY_SIGNATURE_HEADER = 'x-delivery-signature';

// ─── Colours ──────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function ts() {
  return `${c.dim}[${new Date().toISOString()}]${c.reset}`;
}

function divider(label) {
  const line = '─'.repeat(60);
  console.log(`\n${c.cyan}${line}${c.reset}`);
  if (label) console.log(`${c.bold}${c.cyan}  ${label}${c.reset}`);
  console.log(`${c.cyan}${line}${c.reset}`);
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(secret, rawBody, sigHeader) {
  if (!sigHeader) return { ok: false, reason: 'missing header' };
  if (!sigHeader.startsWith('sha256=')) return { ok: false, reason: 'bad format' };

  const provided = sigHeader.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (provided.length !== expected.length) return { ok: false, reason: 'length mismatch' };
  const valid = crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  return valid ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

// ─── Request handler ──────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString('utf-8');
    const sigHeader = req.headers[DELIVERY_SIGNATURE_HEADER];

    divider(`Delivery received  ${ts()}`);

    // Signature check
    if (SECRET) {
      const { ok, reason } = verifySignature(SECRET, rawBody, sigHeader);
      if (ok) {
        console.log(`  ${c.green}✓ Signature valid${c.reset}`);
      } else {
        console.log(`  ${c.red}✗ Signature INVALID — ${reason}${c.reset}`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid signature' }));
        return;
      }
    } else {
      if (sigHeader) {
        console.log(`  ${c.yellow}⚠ Signature header present but SUBSCRIBER_SECRET not set — skipping verification${c.reset}`);
      } else {
        console.log(`  ${c.dim}  No signature verification configured${c.reset}`);
      }
    }

    // Parse and display
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.log(`  ${c.red}✗ Body is not valid JSON${c.reset}`);
      console.log(`  Raw: ${rawBody.slice(0, 200)}`);
      res.writeHead(400).end('Bad Request');
      return;
    }

    console.log(`\n  ${c.bold}Job ID:${c.reset}    ${c.blue}${payload.jobId ?? 'unknown'}${c.reset}`);
    console.log(`  ${c.bold}Status:${c.reset}    ${statusBadge(payload.status)}`);
    console.log(`  ${c.bold}Processed:${c.reset} ${payload.processed ? c.green + 'yes' : c.yellow + 'no'}${c.reset}`);

    if (payload.result && Object.keys(payload.result).length > 0) {
      console.log(`\n  ${c.bold}${c.magenta}Processed Result:${c.reset}`);
      prettyPrint(payload.result, 4);
    }

    if (payload.payload) {
      console.log(`\n  ${c.bold}${c.dim}Original Payload:${c.reset}`);
      prettyPrint(payload.payload, 4);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, received: new Date().toISOString() }));
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    COMPLETED: c.green + 'COMPLETED',
    FAILED: c.red + 'FAILED',
    PENDING: c.yellow + 'PENDING',
    PROCESSING: c.blue + 'PROCESSING',
  };
  return (map[status] ?? c.dim + (status ?? 'unknown')) + c.reset;
}

function prettyPrint(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (typeof v === 'object' && v !== null) {
      console.log(`${pad}${c.dim}${k}:${c.reset}`);
      prettyPrint(v, indent + 2);
    } else {
      console.log(`${pad}${c.dim}${k}:${c.reset} ${c.cyan}${JSON.stringify(v)}${c.reset}`);
    }
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  divider('Pipeline Orchestrator — Subscriber Server');
  console.log(`  ${c.green}Listening on${c.reset}  http://localhost:${PORT}`);
  console.log(`  ${c.bold}Signature:${c.reset}    ${SECRET ? c.green + 'enabled (SUBSCRIBER_SECRET set)' : c.yellow + 'disabled (set SUBSCRIBER_SECRET to enable)'}${c.reset}`);
  console.log(`\n  Waiting for deliveries...\n`);
});
