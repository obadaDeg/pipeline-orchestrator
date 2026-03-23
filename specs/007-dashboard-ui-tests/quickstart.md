# Quickstart: Dashboard UI Test Suite

## Prerequisites

- Node.js 20 LTS
- npm 10+
- (E2E only) Docker + Docker Compose running the full stack on port 4000

---

## 1. Install Test Dependencies

```bash
# Install Vitest + jsdom + coverage provider
cd dashboard
npm install -D vitest @vitest/coverage-v8 jsdom

# Install React Testing Library
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom

# Install MSW v2 (API mocking)
npm install -D msw

# Install Playwright (at repo root, not inside dashboard/)
cd ..
npm install -D @playwright/test
npx playwright install chromium
```

---

## 2. Run Component + Integration Tests

```bash
cd dashboard

# Watch mode (development)
npm test

# Single run (CI)
npm run test:run

# With coverage report
npm run test:coverage
```

All tests run without a backend server or Docker. Expected output: all suites pass in under 60 seconds.

---

## 3. Run E2E Tests

The full Docker stack must be running first:

```bash
# From repo root — start the stack
docker compose up -d

# Run E2E suite (Chromium)
npm run test:e2e

# Interactive UI mode (local debugging)
npm run test:e2e:ui
```

E2E tests automatically:
1. Register a fresh test user via `POST /auth/register`
2. Log in to obtain an API key
3. Inject the key into `localStorage` before each test
4. Clean up created resources via the API after each test

---

## 4. Integration Scenarios (per spec acceptance criteria)

### Component Tests (US1)

| Scenario | File | Assertion |
|----------|------|-----------|
| Badge `completed` variant renders green pill | `Badge.test.tsx` | `toHaveTextContent('Completed')` |
| Button `loading={true}` is disabled with spinner | `Button.test.tsx` | `toBeDisabled()`, spinner visible |
| EmptyState renders heading + action CTA | `EmptyState.test.tsx` | heading + button present |
| ConfirmDialog calls `onCancel` on Cancel click | `ConfirmDialog.test.tsx` | callback invoked |
| SlideOver becomes visible when `open` flips true | `SlideOver.test.tsx` | panel in DOM |
| Tabs calls `onChange` with correct tab ID | `Tabs.test.tsx` | callback called with `"overview"` |

### Page Integration Tests (US2)

| Scenario | File | Mock |
|----------|------|------|
| 2 pipeline cards rendered | `PipelineListPage.test.tsx` | `GET /pipelines` → 2 items |
| Error state shown on API failure | `PipelineListPage.test.tsx` | `GET /pipelines` → 500 |
| Empty state shown with 0 pipelines | `PipelineListPage.test.tsx` | `GET /pipelines` → [] |
| Jobs tab shows table on click | `PipelineDetailPage.test.tsx` | `GET /pipelines/:id` |
| DELETE called + redirect on confirm | `PipelineDetailPage.test.tsx` | `DELETE /pipelines/:id` → 204 |
| New API key revealed after creation | `AccountPage.test.tsx` | `POST /auth/keys` → key |
| Failed delivery attempt row has red tint | `JobDetailPage.test.tsx` | `GET /jobs/:id` |

### E2E Tests (US3)

| Scenario | File | Path |
|----------|------|------|
| Login → pipeline list visible | `login.spec.ts` | `/dashboard/login` |
| Create pipeline → card appears + toast | `pipeline-crud.spec.ts` | `/dashboard/` |
| Copy webhook URL → toast shown | `pipeline-detail.spec.ts` | `/dashboard/pipelines/:id` |
| Delete pipeline + confirm → redirect | `pipeline-crud.spec.ts` | `/dashboard/pipelines/:id` |
| Create API key → revealed once | `account.spec.ts` | `/dashboard/account` |

---

## 5. Key Files

| File | Purpose |
|------|---------|
| `dashboard/vitest.config.ts` | Vitest configuration (jsdom, globals, setupFiles) |
| `dashboard/src/test/setup.ts` | jest-dom import + MSW server lifecycle hooks |
| `dashboard/src/test/server.ts` | MSW `setupServer` instance |
| `dashboard/src/test/handlers.ts` | Default happy-path API handlers |
| `dashboard/src/test/utils.tsx` | `renderWithProviders` (MemoryRouter + ToastProvider + auth) |
| `e2e/playwright.config.ts` | Playwright config (baseURL, timeout, retries) |
| `e2e/fixtures/auth.ts` | Authenticated `page` fixture for E2E tests |

---

## 6. CI Integration

Component + integration tests run on every push (no Docker needed):

```yaml
# .github/workflows/ci.yml — test job
- name: Run unit + integration tests
  run: cd dashboard && npm run test:run
```

E2E tests run on PRs targeting `main` (requires Docker Compose service):

```yaml
# .github/workflows/ci.yml — e2e job
services:
  # postgres + app containers
- name: Run E2E tests
  run: npm run test:e2e
```
