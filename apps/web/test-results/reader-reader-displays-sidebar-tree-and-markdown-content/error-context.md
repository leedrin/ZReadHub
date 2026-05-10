# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reader.spec.ts >> reader displays sidebar tree and markdown content
- Location: tests\e2e\reader.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/reader/demo/1-xiang-mu-gai-lan
Call log:
  - navigating to "http://127.0.0.1:3100/reader/demo/1-xiang-mu-gai-lan", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('reader displays sidebar tree and markdown content', async ({ page }) => {
  4  |   await page.route('**/api/projects/demo/wiki', async (route) => {
  5  |     await route.fulfill({
  6  |       status: 200,
  7  |       contentType: 'application/json',
  8  |       body: JSON.stringify({
  9  |         id: 'demo',
  10 |         title: 'Unity Wiki',
  11 |         generated_at: '2026-05-10T04:41:51.7395171Z',
  12 |         pages: [
  13 |           {
  14 |             slug: '1-xiang-mu-gai-lan',
  15 |             title: '项目概览',
  16 |             file: '1-xiang-mu-gai-lan.md'
  17 |           }
  18 |         ]
  19 |       })
  20 |     });
  21 |   });
  22 | 
  23 |   await page.route('**/api/projects/demo/pages/1-xiang-mu-gai-lan', async (route) => {
  24 |     await route.fulfill({
  25 |       status: 200,
  26 |       contentType: 'application/json',
  27 |       body: JSON.stringify({
  28 |         projectId: 'demo',
  29 |         projectTitle: 'Unity Wiki',
  30 |         slug: '1-xiang-mu-gai-lan',
  31 |         title: '项目概览',
  32 |         content: '## 项目架构\n\n说明内容'
  33 |       })
  34 |     });
  35 |   });
  36 | 
> 37 |   await page.goto('/reader/demo/1-xiang-mu-gai-lan');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/reader/demo/1-xiang-mu-gai-lan
  38 |   await expect(page.getByTestId('reader-sidebar')).toBeVisible();
  39 |   await expect(page.getByRole('heading', { level: 2, name: '项目架构' })).toBeVisible();
  40 | });
```