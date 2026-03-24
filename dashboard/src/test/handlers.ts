import { http, HttpResponse } from 'msw';

// All responses MUST use { data: ... } envelope — useApi.ts unwraps json.data
// (see dashboard/src/hooks/useApi.ts line 42)

const MOCK_PIPELINE = {
  id: 'pipe-1',
  sourceId: 'src-abc123',
  sourceUrl: 'http://localhost:3000/webhooks/src-abc123',
  name: 'Test Pipeline',
  actionType: 'field_extractor',
  actionConfig: { field: 'event' },
  subscribers: [{ id: 'sub-1', url: 'https://example.com/hook' }],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_JOB = {
  id: 'job-1',
  pipelineId: 'pipe-1',
  status: 'COMPLETED',
  rawPayload: '{"event":"user.created"}',
  processedPayload: { event: 'user.created' },
  errorMessage: null,
  createdAt: '2026-01-01T01:00:00.000Z',
  updatedAt: '2026-01-01T01:00:05.000Z',
};

const MOCK_DELIVERY_ATTEMPTS = [
  {
    id: 'da-1',
    outcome: 'SUCCESS',
    httpStatus: 200,
    attemptNumber: 1,
    responseSnippet: '{"ok":true}',
    attemptedAt: '2026-01-01T01:00:03.000Z',
  },
  {
    id: 'da-2',
    outcome: 'FAILED',
    httpStatus: 500,
    attemptNumber: 2,
    responseSnippet: '{"error":"server error"}',
    attemptedAt: '2026-01-01T01:00:04.000Z',
  },
  {
    id: 'da-3',
    outcome: 'SUCCESS',
    httpStatus: 200,
    attemptNumber: 3,
    responseSnippet: '{"ok":true}',
    attemptedAt: '2026-01-01T01:00:05.000Z',
  },
];

const MOCK_API_KEY = {
  id: 'key-1',
  name: 'My Key',
  keyPrefix: 'wh_test',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
};

const MOCK_TEAM = {
  id: 'team-1',
  name: 'Test Team',
  ownerUserId: 'user-1',
  members: [
    { userId: 'user-2', email: 'member@example.com', joinedAt: '2026-01-02T00:00:00.000Z' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const handlers = [
  // Pipelines list
  http.get('/pipelines', () =>
    HttpResponse.json({
      data: { items: [MOCK_PIPELINE], total: 1, page: 1, limit: 20 },
    })
  ),

  // Single pipeline
  http.get('/pipelines/:id', () =>
    HttpResponse.json({ data: MOCK_PIPELINE })
  ),

  // Create pipeline
  http.post('/pipelines', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          ...MOCK_PIPELINE,
          id: 'pipe-new',
          name: (body.name as string) ?? 'New Pipeline',
        },
      },
      { status: 201 }
    );
  }),

  // Delete pipeline
  http.delete('/pipelines/:id', () => new HttpResponse(null, { status: 204 })),

  // Jobs for a pipeline
  http.get('/pipelines/:id/jobs', () =>
    HttpResponse.json({
      data: { items: [MOCK_JOB], total: 1, page: 1, limit: 20 },
    })
  ),

  // Jobs list (global)
  http.get('/jobs', () =>
    HttpResponse.json({
      data: { items: [MOCK_JOB], total: 1, page: 1, limit: 20 },
    })
  ),

  // Single job
  http.get('/jobs/:id', () =>
    HttpResponse.json({ data: MOCK_JOB })
  ),

  // Delivery attempts for a job
  http.get('/jobs/:id/delivery-attempts', () =>
    HttpResponse.json({
      data: { items: MOCK_DELIVERY_ATTEMPTS, total: 3, page: 1, limit: 50 },
    })
  ),

  // API keys list
  http.get('/auth/keys', () =>
    HttpResponse.json({ data: [MOCK_API_KEY] })
  ),

  // Create API key — returns the full key (one-time reveal)
  http.post('/auth/keys', () =>
    HttpResponse.json(
      {
        data: {
          key: 'wh_test_abc123secretkey456',
          keyData: { ...MOCK_API_KEY, id: 'key-new', name: 'New Key' },
        },
      },
      { status: 201 }
    )
  ),

  // Revoke API key
  http.delete('/auth/keys/:id', () => new HttpResponse(null, { status: 204 })),

  // Audit log
  http.get('/auth/audit-log', () =>
    HttpResponse.json({
      data: { items: [], total: 0, page: 1, limit: 20 },
    })
  ),

  // Register
  http.post('/auth/register', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          user: { id: 'user-new', email: body.email as string, createdAt: '2026-01-01T00:00:00.000Z' },
          apiKey: {
            id: 'key-new',
            name: 'Default',
            key: 'wh_test_newregistereduserkey',
            keyPrefix: 'wh_test_n',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
      { status: 201 }
    );
  }),

  // Signing secret — get status
  http.get('/pipelines/:id/signing-secret', () =>
    HttpResponse.json({ data: { active: false, hint: null, createdAt: null } })
  ),

  // Signing secret — generate / rotate
  http.post('/pipelines/:id/signing-secret', () =>
    HttpResponse.json(
      {
        data: {
          secret: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          hint: 'abcdef',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      { status: 201 }
    )
  ),

  // Signing secret — revoke
  http.delete('/pipelines/:id/signing-secret', () => new HttpResponse(null, { status: 204 })),

  // Update pipeline
  http.patch('/pipelines/:id', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      data: {
        ...MOCK_PIPELINE,
        name: (body.name as string) ?? MOCK_PIPELINE.name,
        description: (body.description as string) ?? undefined,
      },
    });
  }),

  // Teams list
  http.get('/teams', () =>
    HttpResponse.json({
      data: {
        items: [
          {
            id: MOCK_TEAM.id,
            name: MOCK_TEAM.name,
            ownerUserId: MOCK_TEAM.ownerUserId,
            memberCount: MOCK_TEAM.members.length,
            isOwner: true,
            createdAt: MOCK_TEAM.createdAt,
          },
        ],
      },
    })
  ),

  // Single team
  http.get('/teams/:id', () =>
    HttpResponse.json({ data: MOCK_TEAM })
  ),

  // Create team
  http.post('/teams', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          id: 'team-new',
          name: (body.name as string) ?? 'New Team',
          ownerUserId: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      { status: 201 }
    );
  }),

  // Add team member
  http.post('/teams/:id/members', () =>
    HttpResponse.json(
      {
        data: {
          teamId: 'team-1',
          userId: 'user-new',
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      { status: 201 }
    )
  ),

  // Remove team member
  http.delete('/teams/:id/members/:userId', () => new HttpResponse(null, { status: 204 })),

  // Delete team
  http.delete('/teams/:id', () => new HttpResponse(null, { status: 204 })),
];
