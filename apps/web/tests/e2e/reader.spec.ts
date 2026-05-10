import { expect, test } from '@playwright/test';

test('reader displays sidebar tree and markdown content', async ({ page }) => {
  await page.route('**/api/projects/demo/wiki', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'demo',
        title: 'Unity Wiki',
        generated_at: '2026-05-10T04:41:51.7395171Z',
        pages: [
          {
            slug: '1-xiang-mu-gai-lan',
            title: '项目概览',
            file: '1-xiang-mu-gai-lan.md'
          }
        ]
      })
    });
  });

  await page.route('**/api/projects/demo/pages/1-xiang-mu-gai-lan', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'demo',
        projectTitle: 'Unity Wiki',
        slug: '1-xiang-mu-gai-lan',
        title: '项目概览',
        content: '## 项目架构\n\n说明内容'
      })
    });
  });

  await page.goto('/reader/demo/1-xiang-mu-gai-lan');
  await expect(page.getByTestId('reader-sidebar')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '项目架构' })).toBeVisible();
});