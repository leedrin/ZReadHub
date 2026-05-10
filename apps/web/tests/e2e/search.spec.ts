import { expect, test } from '@playwright/test';

test('global search returns cross-project results and navigates', async ({ page }) => {
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
        }
      ])
    });
  });

  await page.route('**/api/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          projectId: 'demo',
          projectTitle: 'Unity Wiki',
          slug: 'rag-pipeline',
          pageTitle: 'RAG Pipeline',
          snippet: 'retrieval'
        }
      ])
    });
  });

  await page.route('**/api/projects/demo/wiki', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'demo',
        title: 'Unity Wiki',
        generated_at: null,
        pages: [{ slug: 'rag-pipeline', title: 'RAG Pipeline', file: 'rag.md' }]
      })
    });
  });

  await page.route('**/api/projects/demo/pages/rag-pipeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'demo',
        projectTitle: 'Unity Wiki',
        slug: 'rag-pipeline',
        title: 'RAG Pipeline',
        content: '# RAG Pipeline'
      })
    });
  });

  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByPlaceholder('Search all wiki pages').fill('Protobuf');
  await expect(page.getByTestId('global-search-result')).toHaveCount(1);
  await page.getByTestId('global-search-result').first().click();
  await expect(page).toHaveURL(/\/reader\/demo\/rag-pipeline/);
});