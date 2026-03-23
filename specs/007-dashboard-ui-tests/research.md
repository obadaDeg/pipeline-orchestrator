# Research: Dashboard UI Test Suite

**Date**: 2026-03-23 | **Branch**: `007-dashboard-ui-tests`

---

## 1. Component & Page Integration Test Runner — Vitest

**Decision**: Vitest (`vitest`)
**Rationale**: Vitest is Vite-native — it shares the same config, transforms, and module resolution as the production build. Zero extra bundler configuration needed in a Vite 5 project. Jest-compatible API means familiar syntax. Runs in jsdom with `environment: 'jsdom'`, enabling DOM assertions without a browser. ~10× faster than Jest on cold start for this project size.
**Alternatives considered**: Jest (requires separate babel/ts-jest transform config, not Vite-native), Mocha (no built-in jsdom support, more setup).

**Install**:
```bash
cd dashboard && npm install -D vitest @vitest/coverage-v8 jsdom
```

**`vitest.config.ts`** (extends existing vite.config.ts):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
});
```

**`tsconfig.json`** additions:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src", "src/test"]
}
```

**`package.json` scripts**:
```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

---

## 2. React Component Testing — React Testing Library

**Decision**: `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`
**Rationale**: The standard for React component testing. Encourages testing behaviour as a user would experience it (via roles, labels, text) rather than implementation details (internal state, component instance methods). `user-event` v14 provides realistic simulated browser events (pointer, keyboard). `jest-dom` adds semantic DOM matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`).
**Alternatives considered**: Enzyme (deprecated, not maintained for React 18), testing via Playwright component testing (overkill for unit-level tests).

**Install**:
```bash
cd dashboard && npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

**`src/test/setup.ts`**:
```ts
import '@testing-library/jest-dom';
```

**Usage pattern**:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '../components/Badge';

test('Badge renders completed variant', () => {
  render(<Badge variant="completed" />);
  expect(screen.getByText('Completed')).toBeInTheDocument();
});
```

---

## 3. API Mocking — MSW v2 (Mock Service Worker)

**Decision**: MSW v2 (`msw`) with `setupServer` from `msw/node`
**Rationale**: MSW intercepts `fetch` at the network level rather than mocking module imports, making tests more realistic. v2 uses the `http` namespace with `HttpResponse` and supports `{ once: true }` for per-test overrides. Works seamlessly in jsdom via Node's `fetch` interceptor. Handlers are defined once in a shared file and reused across all page tests.
**Alternatives considered**: `vi.mock` on the `useApi` hook (mocks implementation detail, not network), `jest-fetch-mock` (less ergonomic, no request inspection).

**Install**:
```bash
cd dashboard && npm install -D msw
```

**`src/test/handlers.ts`** (default happy-path handlers):
```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/pipelines', () =>
    HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })
  ),
  http.post('/pipelines', () =>
    HttpResponse.json({ data: { id: 'p1', name: 'Test', actionType: 'field_extractor', actionConfig: {}, subscribers: [], createdAt: new Date().toISOString() } }, { status: 201 })
  ),
  // ... other routes
];
```

**`src/test/server.ts`**:
```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Integration in `setup.ts`**:
```ts
import '@testing-library/jest-dom';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Per-test error override**:
```ts
server.use(
  http.get('/pipelines', () => HttpResponse.json({ error: { code: 'SERVER_ERROR', message: 'Failed' } }, { status: 500 }))
);
```

---

## 4. End-to-End Testing — Playwright

**Decision**: Playwright (`@playwright/test`) with Chromium only for CI
**Rationale**: Playwright is faster, more reliable, and has better TypeScript support than Cypress. No same-origin restrictions. Built-in `request` fixture for API calls in setup/teardown. `storageState` natively saves/restores localStorage (where the API key is stored). Auto-waiting reduces flakiness. `page.evaluate` can directly set localStorage for auth bypass.
**Alternatives considered**: Cypress (slower, same-origin restrictions make API key setup harder), Selenium (verbose, less TypeScript-friendly).

**Install** (at repo root, not inside dashboard/):
```bash
npm install -D @playwright/test
npx playwright install chromium
```

**`e2e/playwright.config.ts`**:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://localhost:4000',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
  },
});
```

**Auth setup pattern** (create user + get key, inject into localStorage):
```ts
// e2e/fixtures/auth.ts
import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

export const test = base.extend({
  page: async ({ page, request }, use) => {
    // Register test user
    await request.post('/auth/register', {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    // Login to get API key
    const res = await request.post('/auth/login', {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const { data } = await res.json();
    const apiKey = data.apiKey.key;

    // Inject key into localStorage before navigating
    await page.goto('/dashboard/login');
    await page.evaluate((key) => localStorage.setItem('pipeline_api_key', key), apiKey);
    await page.goto('/dashboard/');

    await use(page);
  },
});
```

**`package.json` scripts** (root level):
```json
{
  "test:e2e": "playwright test --config=e2e/playwright.config.ts",
  "test:e2e:ui": "playwright test --config=e2e/playwright.config.ts --ui"
}
```

---

## 5. Test File Structure Decision

```text
dashboard/
├── src/
│   ├── test/
│   │   ├── setup.ts          # jest-dom + MSW server lifecycle
│   │   ├── server.ts         # MSW setupServer instance
│   │   ├── handlers.ts       # Default happy-path HTTP handlers
│   │   └── utils.tsx         # renderWithProviders (wraps AuthContext + ToastProvider + Router)
│   ├── components/
│   │   ├── Badge.test.tsx
│   │   ├── Button.test.tsx
│   │   ├── EmptyState.test.tsx
│   │   ├── ErrorState.test.tsx
│   │   ├── SkeletonCard.test.tsx
│   │   ├── SkeletonRow.test.tsx
│   │   ├── SlideOver.test.tsx
│   │   ├── Tabs.test.tsx
│   │   ├── ConfirmDialog.test.tsx
│   │   ├── Toast.test.tsx
│   │   └── Pagination.test.tsx
│   └── pages/
│       ├── PipelineListPage.test.tsx
│       ├── PipelineDetailPage.test.tsx
│       ├── JobDetailPage.test.tsx
│       ├── JobsPage.test.tsx
│       └── AccountPage.test.tsx
├── vitest.config.ts
e2e/
├── playwright.config.ts
├── fixtures/
│   └── auth.ts               # Authenticated page fixture
└── tests/
    ├── login.spec.ts
    ├── pipeline-crud.spec.ts
    ├── pipeline-detail.spec.ts
    └── account.spec.ts
```

**Key insight — `renderWithProviders` utility**: All page tests need React Router, AuthContext, and ToastProvider. A shared helper wraps all three so tests stay focused on assertions:
```tsx
// src/test/utils.tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  // AuthContext requires a valid apiKey to skip the redirect
  // Inject via localStorage before render
  localStorage.setItem('pipeline_api_key', 'test-key');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}
```

---

## 6. CI Integration

**Decision**: Add a `test` job to the existing GitHub Actions workflow that runs `vitest run` (no Docker needed), and a separate `e2e` job that spins up Docker Compose and runs Playwright.
**Rationale**: Keeps fast unit/integration tests separate from the slower E2E suite. Fast tests run on every push; E2E can be gated to PRs targeting main.
