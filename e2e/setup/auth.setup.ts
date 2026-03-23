import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

const TEST_EMAIL = 'e2e-fixed@test.local';
const TEST_PASSWORD = 'E2eTestPass1!';

setup('register and authenticate test user', async ({ request, page }) => {
  // Register — 201 on first run, 422 on re-runs (email already registered — both fine)
  const register = await request.post('/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  // 201 = created, 422 = already registered, 429 = rate limited — all mean we can proceed to login
  if (register.status() === 429) {
    console.warn('Registration rate-limited (429); proceeding to login with existing credentials');
  } else {
    expect([201, 422]).toContain(register.status());
  }

  // Login via API to get the API key directly — avoids UI timing issues
  const loginRes = await request.post('/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  if (!loginRes.ok()) {
    throw new Error(
      `Login failed (${loginRes.status()}): ${await loginRes.text()}\n` +
      'If the DB was reset, the rate limit may have blocked re-registration. ' +
      'Wait 15 minutes or restart the backend to clear rate limits.'
    );
  }

  const body = await loginRes.json();
  const apiKey: string = body.data.apiKey.key;

  // Inject API key into localStorage — mirrors what AuthContext.login() does
  await page.goto('/dashboard/login');
  await page.evaluate(
    ({ key, email }) => {
      localStorage.setItem('pipeline_api_key', key);
      localStorage.setItem('pipeline_user_email', email);
    },
    { key: apiKey, email: TEST_EMAIL }
  );

  // Persist storage state for all chromium project tests
  await page.context().storageState({ path: AUTH_FILE });
});
