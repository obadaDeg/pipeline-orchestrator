import { createServer } from 'http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'bullmq';
import { app } from '../../src/api/server.js';
import { redisConnectionOptions } from '../../src/queue/redis.js';
import { jobConsumer } from '../../src/worker/job-consumer.js';
import { runTestMigrations, testPool, truncateAllTables } from '../helpers/db-test-client.js';
import { createMockServer } from '../helpers/mock-subscriber-server.js';

describe('Pipeline E2E', () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;
  let worker: Worker;
  let mockServer: Awaited<ReturnType<typeof createMockServer>>;

  beforeAll(async () => {
    await runTestMigrations();

    mockServer = await createMockServer();

    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as { port: number }).port;
    baseUrl = `http://localhost:${port}`;

    worker = new Worker('webhook-jobs', jobConsumer, {
      connection: redisConnectionOptions,
      concurrency: 1,
    });
    // Give worker time to connect to Redis and start polling
    await new Promise((r) => setTimeout(r, 500));
  }, 30000);

  afterAll(async () => {
    if (worker) await worker.close();
    if (mockServer) await mockServer.stop();
    if (httpServer) await new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
    await testPool.end();
  });

  beforeEach(async () => {
    await truncateAllTables();
    mockServer.reset();
  });

  async function pollJobStatus(
    jobId: string,
    timeoutMs = 15000,
  ): Promise<{ status: string; [key: string]: unknown }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${baseUrl}/jobs/${jobId}`);
      const body = (await res.json()) as { data: { status: string } };
      if (body.data.status === 'COMPLETED' || body.data.status === 'FAILED') {
        return body.data;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Job ${jobId} did not reach terminal status within ${timeoutMs}ms`);
  }

  it('creates pipeline, ingests webhook, and delivers to subscriber (happy path)', async () => {
    // Create pipeline via REST API
    const createRes = await fetch(`${baseUrl}/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Test Pipeline',
        actionType: 'field_extractor',
        actionConfig: {
          actionType: 'field_extractor',
          mapping: { event: 'event', orderId: 'id' },
        },
        subscriberUrls: [mockServer.url],
      }),
    });
    expect(createRes.status).toBe(201);
    const { data: pipeline } = (await createRes.json()) as {
      data: { id: string; sourceUrl: string };
    };

    // Extract sourceId from the returned sourceUrl
    const sourceId = pipeline.sourceUrl.split('/webhooks/')[1];
    expect(sourceId).toBeDefined();

    // POST webhook to ingestion endpoint
    const webhookRes = await fetch(`${baseUrl}/webhooks/${sourceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order.created', id: '123' }),
    });
    expect(webhookRes.status).toBe(202);
    const { data: jobRef } = (await webhookRes.json()) as { data: { jobId: string } };
    expect(jobRef.jobId).toBeDefined();

    // Poll until the job reaches a terminal state
    const job = await pollJobStatus(jobRef.jobId);
    expect(job.status).toBe('COMPLETED');

    // Verify delivery attempt was recorded as SUCCESS
    const attemptsRes = await fetch(`${baseUrl}/jobs/${jobRef.jobId}/delivery-attempts`);
    expect(attemptsRes.status).toBe(200);
    const { data: attemptsData } = (await attemptsRes.json()) as {
      data: { items: Array<{ outcome: string }> };
    };
    expect(attemptsData.items).toHaveLength(1);
    expect(attemptsData.items[0].outcome).toBe('SUCCESS');

    // Verify the subscriber received the processed payload
    const received = mockServer.getReceivedRequests();
    expect(received).toHaveLength(1);
    expect(received[0].body).toMatchObject({ event: 'order.created', orderId: '123' });
  }, 20000);

  it('marks job as FAILED when subscriber consistently returns 500', async () => {
    mockServer.setResponseStatus(500);

    const createRes = await fetch(`${baseUrl}/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Failing Pipeline',
        actionType: 'field_extractor',
        actionConfig: { actionType: 'field_extractor', mapping: { event: 'event' } },
        subscriberUrls: [mockServer.url],
      }),
    });
    const { data: pipeline } = (await createRes.json()) as { data: { sourceUrl: string } };
    const sourceId = pipeline.sourceUrl.split('/webhooks/')[1];

    const webhookRes = await fetch(`${baseUrl}/webhooks/${sourceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test.event' }),
    });
    const { data: jobRef } = (await webhookRes.json()) as { data: { jobId: string } };

    // Wait for all retry attempts to exhaust
    // DELIVERY_MAX_RETRIES=3, DELIVERY_BACKOFF_MS=1000 → max ~7s backoff + overhead
    const job = await pollJobStatus(jobRef.jobId, 30000);
    expect(job.status).toBe('FAILED');

    const attemptsRes = await fetch(`${baseUrl}/jobs/${jobRef.jobId}/delivery-attempts`);
    const { data: attemptsData } = (await attemptsRes.json()) as {
      data: { items: Array<{ outcome: string }> };
    };
    expect(attemptsData.items.length).toBeGreaterThan(0);
    expect(attemptsData.items.every((a) => a.outcome === 'FAILED')).toBe(true);
  }, 35000);
});
