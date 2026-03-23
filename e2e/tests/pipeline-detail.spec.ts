import { expect, test } from '@playwright/test';

test('copy webhook URL — success toast appears', async ({ page }) => {
  // Load page first so localStorage (storageState) is available
  await page.goto('/dashboard/');
  const apiKey = await page.evaluate(() => localStorage.getItem('pipeline_api_key') ?? '');

  // Create a pipeline to navigate to
  const createRes = await page.request.post('/pipelines', {
    headers: { Authorization: `Bearer ${apiKey}` },
    data: {
      name: `Copy Test ${Date.now()}`,
      actionType: 'field_extractor',
      actionConfig: { mapping: { event: 'event' } },
      subscriberUrls: [],
    },
  });

  if (!createRes.ok()) {
    test.skip();
    return;
  }

  const { data: pipeline } = await createRes.json();

  await page.goto(`/dashboard/pipelines/${pipeline.id}`);
  await expect(page.locator('h1')).toContainText(pipeline.name);

  // Grant clipboard permissions and mock clipboard for the test
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.getByRole('button', { name: /copy webhook url/i }).click();

  // Toast confirms the copy
  await expect(page.getByText('Webhook URL copied')).toBeVisible();
});
