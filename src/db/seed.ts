import { hash, argon2id } from 'argon2';
import { and, eq, count as drizzleCount } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { generateApiKey } from '../lib/api-key.js';
import { db, pool } from './index.js';
import {
  apiKeys,
  deliveryAttempts,
  jobs,
  pipelineSigningSecrets,
  pipelines,
  teamMemberships,
  teams,
  users,
} from './schema.js';

// ─── Demo dataset constants ────────────────────────────────────────────────────

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Password123!';
const MEMBER_EMAIL = 'member@example.com';

const ARGON2_OPTIONS = { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 };

const SUBSCRIBER_URL = 'https://example.com/webhook';

const PIPELINE_DEFS = [
  {
    name: 'GitHub Events',
    actionType: 'field_extractor' as const,
    actionConfig: { mapping: { event: 'event', repo: 'repo', ref: 'ref' } },
    teamKey: 'platform' as const,
    hasSecret: true,
    completedJobs: 4,
    failedJobs: 1,
  },
  {
    name: 'Stripe Payments',
    actionType: 'payload_filter' as const,
    actionConfig: { field: 'type', operator: 'eq', value: 'charge.succeeded' },
    teamKey: 'platform' as const,
    hasSecret: false,
    completedJobs: 3,
    failedJobs: 1,
  },
  {
    name: 'Slack Alerts',
    actionType: 'http_enricher' as const,
    actionConfig: { url: 'https://httpbin.org/post', mergeKey: 'enriched' },
    teamKey: 'data' as const,
    hasSecret: false,
    completedJobs: 1,
    failedJobs: 2,
  },
] as const;

// ─── Logging helper ────────────────────────────────────────────────────────────

function log(entity: string, name: string, action: 'created' | 'skipped'): void {
  const padded = entity.padEnd(10);
  console.log(`[seed] ${padded} ${name} (${action})`);
}

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedUser(email: string, password: string): Promise<string> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    log('User:', email, 'skipped');
    return existing[0].id;
  }
  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const [row] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id });
  log('User:', email, 'created');
  return row.id;
}

async function seedApiKeys(userId: string): Promise<void> {
  const [{ value: existing }] = await db
    .select({ value: drizzleCount() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  if (Number(existing) >= 2) {
    log('ApiKeys:', 'Default + CI/CD', 'skipped');
    return;
  }

  const KEY_NAMES = ['Default', 'CI/CD'] as const;
  for (const name of KEY_NAMES) {
    const { key, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({ userId, name, keyHash, keyPrefix });
    log('ApiKey:', `${name} (${key.slice(0, 12)}…)`, 'created');
  }
}

async function seedTeam(name: string, ownerUserId: string): Promise<string> {
  const existing = await db.select({ id: teams.id }).from(teams).where(eq(teams.name, name));
  if (existing.length > 0) {
    log('Team:', name, 'skipped');
    return existing[0].id;
  }
  const [row] = await db.insert(teams).values({ name, ownerUserId }).returning({ id: teams.id });
  log('Team:', name, 'created');
  return row.id;
}

async function seedMembership(teamId: string, userId: string): Promise<void> {
  const existing = await db
    .select({ id: teamMemberships.id })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId)));
  if (existing.length > 0) return;
  await db.insert(teamMemberships).values({ teamId, userId });
}

async function seedPipeline(
  name: string,
  actionType: 'field_extractor' | 'payload_filter' | 'http_enricher',
  actionConfig: Record<string, unknown>,
  ownerTeamId: string,
): Promise<string> {
  const existing = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.name, name));
  if (existing.length > 0) {
    log('Pipeline:', name, 'skipped');
    return existing[0].id;
  }
  const [row] = await db
    .insert(pipelines)
    .values({ name, actionType, actionConfig, ownerTeamId })
    .returning({ id: pipelines.id });
  log('Pipeline:', name, 'created');
  return row.id;
}

async function seedSigningSecret(pipelineId: string): Promise<void> {
  const existing = await db
    .select({ id: pipelineSigningSecrets.id })
    .from(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId));
  if (existing.length > 0) {
    log('Secret:', pipelineId.slice(0, 8) + '…', 'skipped');
    return;
  }
  const secretValue = randomBytes(32).toString('hex');
  const secretHint = secretValue.slice(-6);
  await db.insert(pipelineSigningSecrets).values({ pipelineId, secretValue, secretHint });
  log('Secret:', pipelineId.slice(0, 8) + '…', 'created');
}

async function seedJobs(
  pipelineId: string,
  completedCount: number,
  failedCount: number,
): Promise<void> {
  const [{ value: existing }] = await db
    .select({ value: drizzleCount() })
    .from(jobs)
    .where(eq(jobs.pipelineId, pipelineId));

  const total = completedCount + failedCount;
  if (Number(existing) >= total) {
    log('Jobs:', `${total} for ${pipelineId.slice(0, 8)}…`, 'skipped');
    return;
  }

  const now = Date.now();
  const FOUR_HOURS_MS = 14_400_000;

  for (let i = 0; i < total; i++) {
    const isCompleted = i < completedCount;
    const status = isCompleted ? ('COMPLETED' as const) : ('FAILED' as const);
    const createdAt = new Date(now - i * FOUR_HOURS_MS);
    const rawPayload = JSON.stringify({ event: 'demo', index: i, pipeline: pipelineId });
    const processedPayload = isCompleted ? { event: 'demo', index: i } : null;
    const errorMessage = isCompleted ? null : 'Subscriber returned 500';

    const [job] = await db
      .insert(jobs)
      .values({ pipelineId, rawPayload, processedPayload, status, errorMessage, createdAt })
      .returning({ id: jobs.id });

    if (isCompleted) {
      await db.insert(deliveryAttempts).values({
        jobId: job.id,
        subscriberUrl: SUBSCRIBER_URL,
        httpStatus: 200,
        responseSnippet: '{"ok":true}',
        attemptNumber: 1,
        outcome: 'SUCCESS',
        attemptedAt: new Date(createdAt.getTime() + 1000),
      });
    } else {
      await db.insert(deliveryAttempts).values([
        {
          jobId: job.id,
          subscriberUrl: SUBSCRIBER_URL,
          httpStatus: 500,
          responseSnippet: '{"error":"internal server error"}',
          attemptNumber: 1,
          outcome: 'FAILED',
          attemptedAt: new Date(createdAt.getTime() + 1000),
        },
        {
          jobId: job.id,
          subscriberUrl: SUBSCRIBER_URL,
          httpStatus: 503,
          responseSnippet: '{"error":"service unavailable"}',
          attemptNumber: 2,
          outcome: 'FAILED',
          attemptedAt: new Date(createdAt.getTime() + 30_000),
        },
      ]);
    }
  }

  log('Jobs:', `${total} for ${pipelineId.slice(0, 8)}…`, 'created');
}

// ─── Main seed function ────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('[seed] Seeding demo data...');

  const demoId = await seedUser(DEMO_EMAIL, DEMO_PASSWORD);
  const memberId = await seedUser(MEMBER_EMAIL, DEMO_PASSWORD);

  await seedApiKeys(demoId);

  const platformTeamId = await seedTeam('Acme Platform', demoId);
  await seedMembership(platformTeamId, memberId);

  const dataTeamId = await seedTeam('Acme Data', demoId);
  await seedMembership(dataTeamId, memberId);

  const teamIds = { platform: platformTeamId, data: dataTeamId };

  for (const def of PIPELINE_DEFS) {
    const pipelineId = await seedPipeline(
      def.name,
      def.actionType,
      def.actionConfig,
      teamIds[def.teamKey],
    );

    if (def.hasSecret) {
      await seedSigningSecret(pipelineId);
    }

    await seedJobs(pipelineId, def.completedJobs, def.failedJobs);
  }

  console.log('[seed] Done.');
}

seed()
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
