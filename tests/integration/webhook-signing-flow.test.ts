import { createHmac } from 'node:crypto';
import { createServer } from 'http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/server.js';
import { runTestMigrations, testPool, truncateAllTables } from '../helpers/db-test-client.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function signWebhook(secret: string, body: string, timestampSeconds?: number): {
  signature: string;
  timestamp: string;
} {
  const ts = String(timestampSeconds ?? Math.floor(Date.now() / 1000));
  const sig = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { signature: sig, timestamp: ts };
}

describe('Webhook Signing Flow (integration)', () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  beforeAll(async () => {
    await runTestMigrations();
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as { port: number }).port;
    baseUrl = `http://localhost:${port}`;
  }, 15000);

  afterAll(async () => {
    if (httpServer) await new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
    await testPool.end();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // ── Shared setup helpers ────────────────────────────────────────────────────

  async function register(email: string): Promise<string> {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { apiKey: { key: string } } };
    return body.data.apiKey.key;
  }

  async function createPipeline(apiKey: string): Promise<{ id: string; sourceId: string }> {
    const res = await fetch(`${baseUrl}/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        name: 'Signing Test Pipeline',
        actionType: 'field_extractor',
        actionConfig: { mapping: { id: 'id' } },
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; sourceUrl: string } };
    const sourceId = body.data.sourceUrl.split('/webhooks/')[1];
    return { id: body.data.id, sourceId };
  }

  async function generateSecret(apiKey: string, pipelineId: string): Promise<string> {
    const res = await fetch(`${baseUrl}/pipelines/${pipelineId}/signing-secret`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { secret: string } };
    return body.data.secret;
  }

  async function sendWebhook(
    sourceId: string,
    body: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(`${baseUrl}/webhooks/${sourceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body,
    });
  }

  // ── Tests ───────────────────────────────────────────────────────────────────

  it('pipeline without a signing secret accepts unsigned webhooks (open mode)', async () => {
    const apiKey = await register('open@example.com');
    const { sourceId } = await createPipeline(apiKey);
    const body = JSON.stringify({ event: 'test' });

    const res = await sendWebhook(sourceId, body);
    expect(res.status).toBe(202);
  });

  it('generates a signing secret and returns it once', async () => {
    const apiKey = await register('generate@example.com');
    const { id } = await createPipeline(apiKey);

    const res = await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { secret: string; hint: string; createdAt: string } };
    expect(body.data.secret).toMatch(/^whsec_/);
    expect(body.data.hint).toBe(body.data.secret.slice(0, 6));
    expect(body.data.createdAt).toBeDefined();
  });

  it('pipeline with a secret accepts a correctly signed webhook (202)', async () => {
    const apiKey = await register('signed@example.com');
    const { id, sourceId } = await createPipeline(apiKey);
    const secret = await generateSecret(apiKey, id);
    const rawBody = JSON.stringify({ event: 'order.created' });
    const { signature, timestamp } = signWebhook(secret, rawBody);

    const res = await sendWebhook(sourceId, rawBody, {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
    });
    expect(res.status).toBe(202);
  });

  it('pipeline with a secret rejects an unsigned webhook (401)', async () => {
    const apiKey = await register('enforce@example.com');
    const { id, sourceId } = await createPipeline(apiKey);
    await generateSecret(apiKey, id);
    const rawBody = JSON.stringify({ event: 'order.created' });

    const res = await sendWebhook(sourceId, rawBody);
    expect(res.status).toBe(401);
  });

  it('rejects a webhook with a timestamp more than 5 minutes in the past (401)', async () => {
    const apiKey = await register('stale@example.com');
    const { id, sourceId } = await createPipeline(apiKey);
    const secret = await generateSecret(apiKey, id);
    const rawBody = JSON.stringify({ event: 'replay.attempt' });
    const staleTs = Math.floor((Date.now() - 6 * 60 * 1000) / 1000); // 6 min ago
    const { signature, timestamp } = signWebhook(secret, rawBody, staleTs);

    const res = await sendWebhook(sourceId, rawBody, {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
    });
    expect(res.status).toBe(401);
  });

  it('rotates the secret — old secret is rejected, new secret is accepted', async () => {
    const apiKey = await register('rotate@example.com');
    const { id, sourceId } = await createPipeline(apiKey);
    const oldSecret = await generateSecret(apiKey, id);
    const newSecret = await generateSecret(apiKey, id); // rotation

    const rawBody = JSON.stringify({ event: 'post-rotation' });

    // Old secret → 401
    const { signature: oldSig, timestamp: oldTs } = signWebhook(oldSecret, rawBody);
    const oldRes = await sendWebhook(sourceId, rawBody, {
      'x-webhook-signature': oldSig,
      'x-webhook-timestamp': oldTs,
    });
    expect(oldRes.status).toBe(401);

    // New secret → 202
    const { signature: newSig, timestamp: newTs } = signWebhook(newSecret, rawBody);
    const newRes = await sendWebhook(sourceId, rawBody, {
      'x-webhook-signature': newSig,
      'x-webhook-timestamp': newTs,
    });
    expect(newRes.status).toBe(202);
  });

  it('revokes the secret — pipeline reverts to open mode (unsigned webhook accepted)', async () => {
    const apiKey = await register('revoke@example.com');
    const { id, sourceId } = await createPipeline(apiKey);
    await generateSecret(apiKey, id);

    // Revoke
    const revokeRes = await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(revokeRes.status).toBe(204);

    // Unsigned webhook should now be accepted
    const rawBody = JSON.stringify({ event: 'post-revocation' });
    const res = await sendWebhook(sourceId, rawBody);
    expect(res.status).toBe(202);
  });

  it('GET /signing-secret returns active=true with hint after generation', async () => {
    const apiKey = await register('status@example.com');
    const { id } = await createPipeline(apiKey);
    const secret = await generateSecret(apiKey, id);

    const res = await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { active: boolean; hint: string } };
    expect(body.data.active).toBe(true);
    expect(body.data.hint).toBe(secret.slice(0, 6));
  });

  it('GET /signing-secret returns active=false after revocation', async () => {
    const apiKey = await register('status-revoked@example.com');
    const { id } = await createPipeline(apiKey);
    await generateSecret(apiKey, id);

    await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const res = await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { active: boolean } };
    expect(body.data.active).toBe(false);
  });

  it('DELETE /signing-secret returns 422 when no secret exists', async () => {
    const apiKey = await register('revoke-none@example.com');
    const { id } = await createPipeline(apiKey);

    const res = await fetch(`${baseUrl}/pipelines/${id}/signing-secret`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(422);
  });
});
