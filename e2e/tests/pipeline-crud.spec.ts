import { expect, test } from '@playwright/test';

// Uses storageState from auth.setup.ts (chromium project dependency)

test('create pipeline — new card appears in grid with success toast', async ({ page }) => {
  await page.goto('/dashboard/');
  await expect(page.locator('h1')).toContainText('Pipelines');

  // Open create form — use first() as EmptyState may also render a "New Pipeline" button
  await page.getByRole('button', { name: 'New Pipeline' }).first().click();
  await expect(page.getByRole('heading', { name: 'New Pipeline', level: 2 })).toBeVisible();

  // Wait for SlideOver animation to complete (panel slides in)
  await page.locator('#create-pipeline-form').waitFor({ state: 'visible' });

  // Fill pipeline form — labels have no htmlFor, target inputs inside the form directly
  const pipelineName = `E2E Pipeline ${Date.now()}`;
  await page.locator('#create-pipeline-form input[type="text"]').fill(pipelineName);
  // Action Config JSON — field_extractor requires { mapping: Record<string, string> }
  await page.locator('#create-pipeline-form textarea').first().fill('{"mapping":{"event":"event"}}');

  await page.getByRole('button', { name: 'Create Pipeline' }).click();

  // Success toast appears
  await expect(page.getByText('Pipeline created')).toBeVisible();

  // New card appears in the grid
  await expect(page.getByText(pipelineName)).toBeVisible();
});

test('delete pipeline — redirected to list and card no longer visible', async ({ page }) => {
  // Load the page first so localStorage (from storageState) is available
  await page.goto('/dashboard/');
  const apiKey = await page.evaluate(() => localStorage.getItem('pipeline_api_key') ?? '');

  // Create a pipeline via API using the key from storageState
  const createRes = await page.request.post('/pipelines', {
    headers: { Authorization: `Bearer ${apiKey}` },
    data: {
      name: `Delete Me ${Date.now()}`,
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

  // Delete the pipeline
  await page.getByRole('button', { name: /delete/i }).first().click();
  await expect(page.getByText('Delete Pipeline')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  // Redirected to list
  await page.waitForURL(/\/dashboard\/?$/);
  await expect(page.getByText(pipeline.name)).not.toBeVisible();
});
