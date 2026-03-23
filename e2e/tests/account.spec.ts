import { expect, test } from '@playwright/test';

test('create API key — revealed once in code block', async ({ page }) => {
  await page.goto('/dashboard/account');
  await expect(page.locator('h1')).toContainText('Account');

  // Fill key name and create
  await page.getByPlaceholder(/key name/i).fill('E2E Test Key');
  await page.getByRole('button', { name: 'Create Key' }).click();

  // One-time key reveal: CodeBlock <pre> appears with the raw key (starts with "wh_")
  const keyBlock = page.locator('pre').filter({ hasText: /^wh_/ });
  await expect(keyBlock).toBeVisible();

  // The revealed key should be non-empty
  const keyText = await keyBlock.textContent();
  expect(keyText?.trim().length).toBeGreaterThan(10);

  // Toast confirms creation (exact toast message)
  await expect(page.getByText('Key created — save it now!')).toBeVisible();
});
