import { expect, test } from '@playwright/test';

// This spec runs without pre-existing auth state — it tests the login flow itself
test.use({ storageState: { cookies: [], origins: [] } });

test('user can log in and see the sidebar', async ({ page, request }) => {
  // Register a dedicated login-spec user (409 = already exists on re-runs, both are fine)
  const email = 'e2e-login-spec@test.local';
  const password = 'E2eTestPass1!';
  const reg = await request.post('/auth/register', { data: { email, password } });
  // 201 = created, 422 = already registered, 429 = rate limited
  expect([201, 422, 429]).toContain(reg.status());

  await page.goto('/dashboard/login');
  await expect(page).toHaveURL(/\/dashboard\/login/);

  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // After login, navigate to pipelines list
  await page.waitForURL(/\/dashboard\/?$/);

  // Sidebar is visible with main navigation links
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Pipelines' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Jobs' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Account' })).toBeVisible();
});
