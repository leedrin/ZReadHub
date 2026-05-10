# Local Wiki Hub MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local multi-project Wiki Hub that auto-discovers zread wiki projects, provides a zread.ai-like dashboard and reader, and supports cross-project search.

**Architecture:** Use a pnpm monorepo with `apps/api` (Fastify + file-system scanner + search index) and `apps/web` (Next.js + Tailwind + markdown renderer). The API normalizes all local `.zread/wiki` data into stable contracts, and the web app consumes only API contracts. Search index is built server-side and queried through API for consistent behavior across projects.

**Tech Stack:** TypeScript, Node.js, pnpm workspace, Fastify, Zod, Next.js App Router, Tailwind CSS, React Markdown, remark-gfm, rehype-pretty-code, Mermaid, Vitest, Playwright.

---

## Scope Check

This plan covers one cohesive subsystem set for MVP delivery: scanner + API + web reader + global search + acceptance tests. It intentionally excludes P1 features (`zread generate` trigger, filesystem watch daemon) to keep one testable release slice.

## Planned File Structure

### Create

- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/server.ts`
- `apps/api/src/config.ts`
- `apps/api/src/types.ts`
- `apps/api/src/scanner/projectScanner.ts`
- `apps/api/src/scanner/wikiResolver.ts`
- `apps/api/src/scanner/metadataExtractor.ts`
- `apps/api/src/search/indexBuilder.ts`
- `apps/api/src/search/searchService.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/wiki.ts`
- `apps/api/src/routes/search.ts`
- `apps/api/src/utils/pathSafety.ts`
- `apps/api/tests/scanner.spec.ts`
- `apps/api/tests/routes.projects.spec.ts`
- `apps/api/tests/routes.wiki.spec.ts`
- `apps/api/tests/search.spec.ts`
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/postcss.config.js`
- `apps/web/tailwind.config.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/reader/[projectId]/[[...slug]]/page.tsx`
- `apps/web/src/components/dashboard/ProjectCard.tsx`
- `apps/web/src/components/dashboard/ProjectGrid.tsx`
- `apps/web/src/components/reader/ReaderSidebar.tsx`
- `apps/web/src/components/reader/MarkdownView.tsx`
- `apps/web/src/components/search/GlobalSearchDialog.tsx`
- `apps/web/src/lib/apiClient.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/themeTokens.css`
- `apps/web/tests/e2e/dashboard.spec.ts`
- `apps/web/tests/e2e/reader.spec.ts`
- `apps/web/tests/e2e/search.spec.ts`
- `.github/workflows/ci.yml`
- `docs/superpowers/plans/2026-05-10-wiki-hub-test-acceptance.md`

### Responsibility Map

- `apps/api/src/scanner/*`: discover projects and normalize wiki metadata from local filesystem.
- `apps/api/src/routes/*`: expose API contracts used by web only.
- `apps/api/src/search/*`: build and query cross-project index.
- `apps/web/src/app/*`: route-level UI composition.
- `apps/web/src/components/*`: reusable UI sections for dashboard, reader, search.
- `apps/web/src/lib/*`: API client and shared frontend types.
- `apps/web/tests/e2e/*`: behavior-level acceptance automation.

### Task 1: Monorepo Bootstrap And Tooling

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`

- [ ] **Step 1: Write the failing workspace sanity test command**

```bash
pnpm -r test
```

Expected: command fails because no workspace and test scripts exist yet.

- [ ] **Step 2: Create minimal workspace configuration**

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
```

```json
{
  "name": "zread-wiki-hub",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @wikihub/api --filter @wikihub/web dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

- [ ] **Step 3: Add package-level scripts that still fail (red state)**

```json
{
  "name": "@wikihub/api",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint ."
  }
}
```

```json
{
  "name": "@wikihub/web",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "test": "playwright test",
    "lint": "next lint"
  }
}
```

- [ ] **Step 4: Verify workspace command now resolves scripts**

Run: `pnpm -r test`
Expected: scripts are discovered, tests fail due to missing test files/deps (acceptable red state).

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json apps/api/package.json apps/web/package.json
git commit -m "chore: bootstrap wikihub monorepo workspace"
```

### Task 2: Scanner Core With Safe Path Boundaries

**Files:**
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/utils/pathSafety.ts`
- Create: `apps/api/src/scanner/projectScanner.ts`
- Create: `apps/api/src/scanner/wikiResolver.ts`
- Test: `apps/api/tests/scanner.spec.ts`

- [ ] **Step 1: Write failing scanner tests**

```ts
import { describe, it, expect } from 'vitest';
import { isPathInsideRoots } from '../src/utils/pathSafety';
import { detectWikiProject } from '../src/scanner/projectScanner';

describe('path safety', () => {
  it('allows paths under approved roots', () => {
    expect(isPathInsideRoots('C:/repos/a/.zread/wiki/current', ['C:/repos'])).toBe(true);
  });

  it('blocks traversal outside approved roots', () => {
    expect(isPathInsideRoots('C:/repos/../Windows/System32', ['C:/repos'])).toBe(false);
  });
});

describe('project discovery', () => {
  it('detects a project when .zread/wiki/current exists', async () => {
    const result = await detectWikiProject('fixtures/project-a');
    expect(result?.hasWiki).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wikihub/api test -- scanner.spec.ts`
Expected: FAIL with module/function not found.

- [ ] **Step 3: Implement minimal scanner and safety code**

```ts
// apps/api/src/utils/pathSafety.ts
import path from 'node:path';

export function isPathInsideRoots(targetPath: string, roots: string[]): boolean {
  const normalizedTarget = path.resolve(targetPath);
  return roots.some((root) => {
    const normalizedRoot = path.resolve(root);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + path.sep);
  });
}
```

```ts
// apps/api/src/scanner/projectScanner.ts
import { access } from 'node:fs/promises';
import path from 'node:path';

export async function detectWikiProject(projectRoot: string): Promise<{ hasWiki: boolean; currentFile?: string } | null> {
  const currentFile = path.join(projectRoot, '.zread', 'wiki', 'current');
  try {
    await access(currentFile);
    return { hasWiki: true, currentFile };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @wikihub/api test -- scanner.spec.ts`
Expected: PASS for path safety and project detection.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/config.ts apps/api/src/utils/pathSafety.ts apps/api/src/scanner/projectScanner.ts apps/api/src/scanner/wikiResolver.ts apps/api/tests/scanner.spec.ts
git commit -m "feat(api): add safe project scanner for zread wiki"
```

### Task 3: Metadata Extraction And Catalog Normalization

**Files:**
- Create: `apps/api/src/scanner/metadataExtractor.ts`
- Modify: `apps/api/src/scanner/projectScanner.ts`
- Create: `apps/api/tests/routes.projects.spec.ts`
- Create: `apps/api/src/routes/projects.ts`

- [ ] **Step 1: Write failing catalog contract test**

```ts
import { describe, it, expect } from 'vitest';
import { buildProjectCatalogEntry } from '../src/scanner/metadataExtractor';

describe('catalog normalization', () => {
  it('maps wiki.json into dashboard-safe metadata', async () => {
    const entry = await buildProjectCatalogEntry('fixtures/project-a');
    expect(entry.title).toBeTruthy();
    expect(entry.pageCount).toBeGreaterThan(0);
    expect(entry.wikiStatus).toBe('ready');
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `pnpm --filter @wikihub/api test -- routes.projects.spec.ts`
Expected: FAIL with unresolved import/undefined function.

- [ ] **Step 3: Implement metadata extraction**

```ts
// apps/api/src/scanner/metadataExtractor.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type WikiJson = {
  generated_at?: string;
  pages?: Array<{ title: string; slug: string; section?: string; group?: string }>;
};

export async function buildProjectCatalogEntry(projectRoot: string) {
  const current = (await readFile(path.join(projectRoot, '.zread', 'wiki', 'current'), 'utf8')).trim();
  const wikiVersionPath = path.join(projectRoot, '.zread', 'wiki', current.replace(/^versions\//, 'versions/'));
  const wiki = JSON.parse(await readFile(path.join(wikiVersionPath, 'wiki.json'), 'utf8')) as WikiJson;

  return {
    id: Buffer.from(projectRoot).toString('base64url'),
    rootPath: projectRoot,
    title: path.basename(projectRoot),
    summary: 'Auto extracted from local zread wiki',
    wikiStatus: 'ready' as const,
    pageCount: wiki.pages?.length ?? 0,
    lastGeneratedAt: wiki.generated_at ?? null
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @wikihub/api test -- routes.projects.spec.ts`
Expected: PASS and catalog entry fields are stable.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scanner/metadataExtractor.ts apps/api/src/scanner/projectScanner.ts apps/api/src/routes/projects.ts apps/api/tests/routes.projects.spec.ts
git commit -m "feat(api): normalize project metadata for dashboard"
```

### Task 4: Wiki Read API (Project List, Wiki Tree, Page Content)

**Files:**
- Create: `apps/api/src/routes/wiki.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/tests/routes.wiki.spec.ts`

- [ ] **Step 1: Write failing route tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server';

describe('wiki routes', () => {
  it('GET /api/projects returns project catalog', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/projects/:id/wiki returns wiki tree', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/projects/demo/wiki' });
    expect([200, 404]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `pnpm --filter @wikihub/api test -- routes.wiki.spec.ts`
Expected: FAIL because routes/server are not wired.

- [ ] **Step 3: Implement route handlers and server wiring**

```ts
// apps/api/src/server.ts
import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects';
import { registerWikiRoutes } from './routes/wiki';
import { registerSearchRoutes } from './routes/search';

export function buildServer() {
  const app = Fastify({ logger: true });
  app.register(registerProjectRoutes, { prefix: '/api' });
  app.register(registerWikiRoutes, { prefix: '/api' });
  app.register(registerSearchRoutes, { prefix: '/api' });
  return app;
}
```

```ts
// apps/api/src/routes/wiki.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

export async function registerWikiRoutes(app: FastifyInstance) {
  app.get('/projects/:id/wiki', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!app.projectMap?.[id]) return reply.code(404).send({ message: 'Project not found' });
    const wikiPath = path.join(app.projectMap[id].wikiVersionPath, 'wiki.json');
    const wiki = JSON.parse(await readFile(wikiPath, 'utf8'));
    return wiki;
  });

  app.get('/projects/:id/pages/:slug', async (req, reply) => {
    const { id, slug } = req.params as { id: string; slug: string };
    if (!app.projectMap?.[id]) return reply.code(404).send({ message: 'Project not found' });
    const page = app.projectMap[id].pageMap[slug];
    if (!page) return reply.code(404).send({ message: 'Page not found' });
    const content = await readFile(path.join(app.projectMap[id].wikiVersionPath, page.file), 'utf8');
    return { ...page, content };
  });
}
```

- [ ] **Step 4: Run route tests**

Run: `pnpm --filter @wikihub/api test -- routes.wiki.spec.ts`
Expected: PASS for 200/404 contracts.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/routes/projects.ts apps/api/src/routes/wiki.ts apps/api/tests/routes.wiki.spec.ts
git commit -m "feat(api): expose project wiki tree and page content routes"
```

### Task 5: Global Search Index And Query API

**Files:**
- Create: `apps/api/src/search/indexBuilder.ts`
- Create: `apps/api/src/search/searchService.ts`
- Create: `apps/api/src/routes/search.ts`
- Create: `apps/api/tests/search.spec.ts`

- [ ] **Step 1: Write failing search tests**

```ts
import { describe, it, expect } from 'vitest';
import { createSearchService } from '../src/search/searchService';

describe('search service', () => {
  it('returns cross-project hits with project and slug', async () => {
    const service = await createSearchService([{ projectId: 'a', pageTitle: 'RAG Pipeline', slug: 'rag', content: 'embedding retrieval'}]);
    const hits = service.search('retrieval');
    expect(hits[0]).toMatchObject({ projectId: 'a', slug: 'rag' });
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `pnpm --filter @wikihub/api test -- search.spec.ts`
Expected: FAIL due to missing search service.

- [ ] **Step 3: Implement search index and route**

```ts
// apps/api/src/search/searchService.ts
import FlexSearch from 'flexsearch';

type SearchDoc = {
  id: string;
  projectId: string;
  projectTitle: string;
  slug: string;
  pageTitle: string;
  content: string;
};

export async function createSearchService(docs: SearchDoc[]) {
  const index = new FlexSearch.Document<SearchDoc, true>({
    document: {
      id: 'id',
      index: ['projectTitle', 'pageTitle', 'content'],
      store: true
    },
    tokenize: 'forward'
  });

  docs.forEach((doc) => index.add(doc));

  return {
    search(query: string) {
      const result = index.search(query, { enrich: true, limit: 20 });
      const flattened = result.flatMap((bucket) => bucket.result.map((r) => r.doc));
      return flattened.map((doc) => ({
        projectId: doc.projectId,
        projectTitle: doc.projectTitle,
        slug: doc.slug,
        pageTitle: doc.pageTitle,
        snippet: doc.content.slice(0, 180)
      }));
    }
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @wikihub/api test -- search.spec.ts`
Expected: PASS and search returns stable hit schema.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/search/indexBuilder.ts apps/api/src/search/searchService.ts apps/api/src/routes/search.ts apps/api/tests/search.spec.ts
git commit -m "feat(api): add cross-project full-text search endpoint"
```

### Task 6: Dashboard UI (Project Grid + Filters)

**Files:**
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/apiClient.ts`
- Create: `apps/web/src/components/dashboard/ProjectCard.tsx`
- Create: `apps/web/src/components/dashboard/ProjectGrid.tsx`
- Create: `apps/web/src/app/page.tsx`
- Test: `apps/web/tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Write failing dashboard E2E test**

```ts
import { test, expect } from '@playwright/test';

test('dashboard shows project cards and search filter', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.getByRole('heading', { name: 'Wiki Hub' })).toBeVisible();
  await page.getByPlaceholder('Search projects').fill('Unity');
  await expect(page.getByTestId('project-card')).toHaveCount(1);
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `pnpm --filter @wikihub/web test -- dashboard.spec.ts`
Expected: FAIL because page/components do not exist.

- [ ] **Step 3: Implement dashboard page and card components**

```tsx
// apps/web/src/components/dashboard/ProjectCard.tsx
import Link from 'next/link';
import type { ProjectMeta } from '@/lib/types';

export function ProjectCard({ project }: { project: ProjectMeta }) {
  return (
    <Link data-testid="project-card" href={`/reader/${project.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-lg font-semibold text-neutral-900">{project.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{project.summary}</p>
      <div className="mt-4 text-xs text-neutral-500">{project.pageCount} pages</div>
    </Link>
  );
}
```

```tsx
// apps/web/src/app/page.tsx
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Wiki Hub</h1>
      <ProjectGrid />
    </main>
  );
}
```

- [ ] **Step 4: Run dashboard test**

Run: `pnpm --filter @wikihub/web test -- dashboard.spec.ts`
Expected: PASS with rendered heading, input, filtered cards.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/apiClient.ts apps/web/src/components/dashboard/ProjectCard.tsx apps/web/src/components/dashboard/ProjectGrid.tsx apps/web/src/app/page.tsx apps/web/tests/e2e/dashboard.spec.ts
git commit -m "feat(web): add dashboard project grid with client-side filtering"
```

### Task 7: Reader UI (Sidebar + Markdown + Route Navigation)

**Files:**
- Create: `apps/web/src/app/reader/[projectId]/[[...slug]]/page.tsx`
- Create: `apps/web/src/components/reader/ReaderSidebar.tsx`
- Create: `apps/web/src/components/reader/MarkdownView.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/tests/e2e/reader.spec.ts`

- [ ] **Step 1: Write failing reader test**

```ts
import { test, expect } from '@playwright/test';

test('reader displays sidebar tree and markdown content', async ({ page }) => {
  await page.goto('http://localhost:3000/reader/demo/1-xiang-mu-gai-lan');
  await expect(page.getByTestId('reader-sidebar')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '项目架构' })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `pnpm --filter @wikihub/web test -- reader.spec.ts`
Expected: FAIL route/components missing.

- [ ] **Step 3: Implement reader route and markdown renderer**

```tsx
// apps/web/src/components/reader/MarkdownView.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
```

```tsx
// apps/web/src/app/reader/[projectId]/[[...slug]]/page.tsx
import { ReaderSidebar } from '@/components/reader/ReaderSidebar';
import { MarkdownView } from '@/components/reader/MarkdownView';
import { apiClient } from '@/lib/apiClient';

export default async function ReaderPage({ params }: { params: { projectId: string; slug?: string[] } }) {
  const slug = params.slug?.[0];
  const wiki = await apiClient.getWiki(params.projectId);
  const fallbackSlug = slug ?? wiki.pages[0].slug;
  const page = await apiClient.getPage(params.projectId, fallbackSlug);

  return (
    <main className="grid min-h-screen grid-cols-[300px_1fr]">
      <ReaderSidebar data-testid="reader-sidebar" projectId={params.projectId} wiki={wiki} activeSlug={fallbackSlug} />
      <section className="px-8 py-8">
        <MarkdownView content={page.content} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run reader tests**

Run: `pnpm --filter @wikihub/web test -- reader.spec.ts`
Expected: PASS with sidebar and markdown visible.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/reader/[projectId]/[[...slug]]/page.tsx apps/web/src/components/reader/ReaderSidebar.tsx apps/web/src/components/reader/MarkdownView.tsx apps/web/src/app/globals.css apps/web/tests/e2e/reader.spec.ts
git commit -m "feat(web): add wiki reader layout with sidebar and markdown"
```

### Task 8: Global Search Dialog And Cross-Project Jump

**Files:**
- Create: `apps/web/src/components/search/GlobalSearchDialog.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/lib/apiClient.ts`
- Test: `apps/web/tests/e2e/search.spec.ts`

- [ ] **Step 1: Write failing search UI test**

```ts
import { test, expect } from '@playwright/test';

test('global search returns cross-project results and navigates', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.keyboard.press('Control+K');
  await page.getByPlaceholder('Search all wiki pages').fill('Protobuf');
  await expect(page.getByTestId('global-search-result')).toHaveCount(1);
  await page.getByTestId('global-search-result').first().click();
  await expect(page).toHaveURL(/\/reader\/.+\/.+/);
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `pnpm --filter @wikihub/web test -- search.spec.ts`
Expected: FAIL because search dialog not present.

- [ ] **Step 3: Implement global search dialog**

```tsx
// apps/web/src/components/search/GlobalSearchDialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ projectId: string; slug: string; pageTitle: string; projectTitle: string }>>([]);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) return setResults([]);
    apiClient.search(query).then(setResults);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-4 shadow-xl">
        <input placeholder="Search all wiki pages" className="w-full rounded-xl border px-3 py-2" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="mt-3 space-y-2">
          {results.map((item) => (
            <button
              data-testid="global-search-result"
              key={`${item.projectId}:${item.slug}`}
              className="w-full rounded-lg border px-3 py-2 text-left"
              onClick={() => router.push(`/reader/${item.projectId}/${item.slug}`)}
            >
              <div className="text-sm font-medium">{item.pageTitle}</div>
              <div className="text-xs text-neutral-500">{item.projectTitle}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

Run: `pnpm --filter @wikihub/web test -- search.spec.ts`
Expected: PASS for open-search-result-navigate flow.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/search/GlobalSearchDialog.tsx apps/web/src/app/layout.tsx apps/web/src/lib/apiClient.ts apps/web/tests/e2e/search.spec.ts
git commit -m "feat(web): add cmdk-style global search and cross-project navigation"
```

### Task 9: Visual Styling Alignment To zread.ai Feel

**Files:**
- Create: `apps/web/src/lib/themeTokens.css`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Write failing visual regression assertion**

```ts
import { test, expect } from '@playwright/test';

test('dashboard visual baseline', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveScreenshot('dashboard-baseline.png', { fullPage: true, maxDiffPixelRatio: 0.05 });
});
```

- [ ] **Step 2: Run test to confirm no baseline exists yet**

Run: `pnpm --filter @wikihub/web test -- dashboard.spec.ts --update-snapshots=false`
Expected: FAIL with missing/changed screenshot baseline.

- [ ] **Step 3: Add theme tokens + prose overrides**

```css
/* apps/web/src/lib/themeTokens.css */
:root {
  --background: #f6f7f9;
  --foreground: #0f172a;
  --card: #ffffff;
  --border: #e2e8f0;
  --muted-foreground: #64748b;
  --theme: #0ea5e9;
  --radius-card: 16px;
}

.dark {
  --background: #0b1220;
  --foreground: #e5e7eb;
  --card: #121a2b;
  --border: #263247;
  --muted-foreground: #94a3b8;
  --theme: #38bdf8;
}
```

```css
/* apps/web/src/app/globals.css */
@import '../lib/themeTokens.css';

body {
  background: radial-gradient(circle at top right, #e8f3ff 0%, var(--background) 50%);
  color: var(--foreground);
}

.prose {
  max-width: none;
}
```

- [ ] **Step 4: Update snapshot and verify pass**

Run: `pnpm --filter @wikihub/web test -- dashboard.spec.ts --update-snapshots`
Expected: PASS and baseline image generated.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/themeTokens.css apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/tests/e2e/dashboard.spec.ts
git commit -m "style(web): align dashboard and reader with zread-like visual tokens"
```

### Task 10: CI Pipeline And Release Gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing CI dry-run command locally**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: FAIL until all scripts/dependencies are complete.

- [ ] **Step 2: Add CI workflow**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 3: Ensure scripts map correctly to CI**

```json
{
  "scripts": {
    "verify": "pnpm lint && pnpm test && pnpm build"
  }
}
```

- [ ] **Step 4: Run verification locally**

Run: `pnpm verify`
Expected: PASS after all previous tasks land.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml package.json apps/api/package.json apps/web/package.json
git commit -m "ci: add lint test build verification pipeline"
```

## Dependency Install Command Bundle

Run once before Task 2 if dependencies are missing:

```bash
pnpm add -Dw typescript tsx vitest @types/node eslint
pnpm --filter @wikihub/api add fastify zod flexsearch
pnpm --filter @wikihub/api add -D @vitest/coverage-v8
pnpm --filter @wikihub/web add next react react-dom react-markdown remark-gfm rehype-pretty-code mermaid
pnpm --filter @wikihub/web add -D tailwindcss postcss autoprefixer @playwright/test @types/react @types/react-dom
```

## Test Execution Matrix

- API unit/integration: `pnpm --filter @wikihub/api test`
- Web e2e: `pnpm --filter @wikihub/web test`
- Full regression: `pnpm verify`

## Self-Review

### 1. Spec coverage

- Auto discovery: Task 2 + Task 3
- Dashboard cards/filter: Task 6 + Task 9
- Reader with sidebar + markdown: Task 7
- Global cross-project search: Task 5 + Task 8
- Quality gate and reproducibility: Task 10

Gap check result: no MVP requirement gap found.

### 2. Placeholder scan

- No `TODO/TBD/implement later` placeholders.
- Every task includes explicit file targets, commands, and expected outcomes.

### 3. Type consistency

- `projectId`, `slug`, `pageTitle`, `projectTitle` naming kept consistent across API and UI tasks.
- Search result shape is consistent in Task 5 and Task 8.

Plan complete and saved to `docs/superpowers/plans/2026-05-10-local-wiki-hub-mvp-implementation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
