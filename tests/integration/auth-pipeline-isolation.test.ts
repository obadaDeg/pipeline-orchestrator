import { createServer } from 'http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/server.js';
import { runTestMigrations, testPool, truncateAllTables } from '../helpers/db-test-client.js';

describe('Pipeline ownership isolation', () => {
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
    await new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
    await testPool.end();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  async function register(email: string, password: string): Promise<string> {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { apiKey: string } };
    return body.data.apiKey;
  }

  async function createPipeline(apiKey: string, name: string): Promise<{ id: string }> {
    const res = await fetch(`${baseUrl}/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name,
        actionType: 'field_extractor',
        actionConfig: { mapping: { id: 'id' } },
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    return body.data;
  }

  it('each user only sees their own pipelines in list', async () => {
    const keyA = await register('alice@example.com', 'password123');
    const keyB = await register('bob@example.com', 'password123');

    await createPipeline(keyA, 'Alice Pipeline');
    await createPipeline(keyB, 'Bob Pipeline');

    const resA = await fetch(`${baseUrl}/pipelines`, {
      headers: { Authorization: `Bearer ${keyA}` },
    });
    const bodyA = (await resA.json()) as { data: { items: { name: string }[] } };
    expect(bodyA.data.items).toHaveLength(1);
    expect(bodyA.data.items[0].name).toBe('Alice Pipeline');

    const resB = await fetch(`${baseUrl}/pipelines`, {
      headers: { Authorization: `Bearer ${keyB}` },
    });
    const bodyB = (await resB.json()) as { data: { items: { name: string }[] } };
    expect(bodyB.data.items).toHaveLength(1);
    expect(bodyB.data.items[0].name).toBe('Bob Pipeline');
  });

  it('returns 404 when user accesses another user\'s pipeline', async () => {
    const keyA = await register('alice2@example.com', 'password123');
    const keyB = await register('bob2@example.com', 'password123');

    const pipeline = await createPipeline(keyA, 'Alice Private Pipeline');

    // Bob tries to access Alice's pipeline — should get 404 (not 403) to prevent enumeration
    const res = await fetch(`${baseUrl}/pipelines/${pipeline.id}`, {
      headers: { Authorization: `Bearer ${keyB}` },
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when user tries to update another user\'s pipeline', async () => {
    const keyA = await register('alice3@example.com', 'password123');
    const keyB = await register('bob3@example.com', 'password123');

    const pipeline = await createPipeline(keyA, 'Alice Pipeline');

    const res = await fetch(`${baseUrl}/pipelines/${pipeline.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keyB}`,
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when user tries to delete another user\'s pipeline', async () => {
    const keyA = await register('alice4@example.com', 'password123');
    const keyB = await register('bob4@example.com', 'password123');

    const pipeline = await createPipeline(keyA, 'Alice Pipeline');

    const res = await fetch(`${baseUrl}/pipelines/${pipeline.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${keyB}` },
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 when accessing pipelines without an API key', async () => {
    const res = await fetch(`${baseUrl}/pipelines`);
    expect(res.status).toBe(401);
  });
});
