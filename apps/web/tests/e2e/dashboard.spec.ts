import { expect, test } from '@playwright/test';

test('dashboard shows project cards and search filter', async ({ page }) => {
  await page.route('**/api/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'demo',
          title: 'Unity Wiki',
          summary: 'Unity project wiki',
          rootPath: 'C:/demo',
          wikiStatus: 'ready',
          pageCount: 20,
          tags: ['game'],
          lastGeneratedAt: '2026-05-10T04:41:51.7395171Z'
        },
        {
          id: 'demo2',
          title: 'Backend Wiki',
          summary: 'Backend docs',
          rootPath: 'C:/backend',
          wikiStatus: 'ready',
          pageCount: 8,
          tags: ['backend'],
          lastGeneratedAt: '2026-05-10T04:41:51.7395171Z'
        }
      ])
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Wiki Hub' })).toBeVisible();
  await page.getByPlaceholder('Search projects').fill('Unity');
  await expect(page.getByTestId('project-card')).toHaveCount(1);
});