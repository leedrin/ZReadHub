# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search.spec.ts >> global search returns cross-project results and navigates
- Location: tests\e2e\search.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/
Call log:
  - navigating to "http://127.0.0.1:3100/", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('global search returns cross-project results and navigates', async ({ page }) => {
  4  |   await page.route('**/api/projects', async (route) => {
  5  |     await route.fulfill({
  6  |       status: 200,
  7  |       contentType: 'application/json',
  8  |       body: JSON.stringify([
  9  |         {
  10 |           id: 'demo',
  11 |           title: 'Unity Wiki',
  12 |           summary: 'Unity project wiki',
  13 |           rootPath: 'C:/demo',
  14 |           wikiStatus: 'ready',
  15 |           pageCount: 20,
  16 |           tags: ['game'],
  17 |           lastGeneratedAt: '2026-05-10T04:41:51.7395171Z'
  18 |         }
  19 |       ])
  20 |     });
  21 |   });
  22 | 
  23 |   await page.route('**/api/search**', async (route) => {
  24 |     await route.fulfill({
  25 |       status: 200,
  26 |       contentType: 'application/json',
  27 |       body: JSON.stringify([
  28 |         {
  29 |           projectId: 'demo',
  30 |           projectTitle: 'Unity Wiki',
  31 |           slug: 'rag-pipeline',
  32 |           pageTitle: 'RAG Pipeline',
  33 |           snippet: 'retrieval'
  34 |         }
  35 |       ])
  36 |     });
  37 |   });
  38 | 
  39 |   await page.route('**/api/projects/demo/wiki', async (route) => {
  40 |     await route.fulfill({
  41 |       status: 200,
  42 |       contentType: 'application/json',
  43 |       body: JSON.stringify({
  44 |         id: 'demo',
  45 |         title: 'Unity Wiki',
  46 |         generated_at: null,
  47 |         pages: [{ slug: 'rag-pipeline', title: 'RAG Pipeline', file: 'rag.md' }]
  48 |       })
  49 |     });
  50 |   });
  51 | 
  52 |   await page.route('**/api/projects/demo/pages/rag-pipeline', async (route) => {
  53 |     await route.fulfill({
  54 |       status: 200,
  55 |       contentType: 'application/json',
  56 |       body: JSON.stringify({
  57 |         projectId: 'demo',
  58 |         projectTitle: 'Unity Wiki',
  59 |         slug: 'rag-pipeline',
  60 |         title: 'RAG Pipeline',
  61 |         content: '# RAG Pipeline'
  62 |       })
  63 |     });
  64 |   });
  65 | 
> 66 |   await page.goto('/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/
  67 |   await page.keyboard.press('Control+K');
  68 |   await page.getByPlaceholder('Search all wiki pages').fill('Protobuf');
  69 |   await expect(page.getByTestId('global-search-result')).toHaveCount(1);
  70 |   await page.getByTestId('global-search-result').first().click();
  71 |   await expect(page).toHaveURL(/\/reader\/demo\/rag-pipeline/);
  72 | });
```