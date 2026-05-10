# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> dashboard shows project cards and search filter
- Location: tests\e2e\dashboard.spec.ts:3:1

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
  3  | test('dashboard shows project cards and search filter', async ({ page }) => {
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
  18 |         },
  19 |         {
  20 |           id: 'demo2',
  21 |           title: 'Backend Wiki',
  22 |           summary: 'Backend docs',
  23 |           rootPath: 'C:/backend',
  24 |           wikiStatus: 'ready',
  25 |           pageCount: 8,
  26 |           tags: ['backend'],
  27 |           lastGeneratedAt: '2026-05-10T04:41:51.7395171Z'
  28 |         }
  29 |       ])
  30 |     });
  31 |   });
  32 | 
> 33 |   await page.goto('/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/
  34 |   await expect(page.getByRole('heading', { name: 'Wiki Hub' })).toBeVisible();
  35 |   await page.getByPlaceholder('Search projects').fill('Unity');
  36 |   await expect(page.getByTestId('project-card')).toHaveCount(1);
  37 | });
```