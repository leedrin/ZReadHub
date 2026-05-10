import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildServer } from '../src/server';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('wiki routes', () => {
  it('GET /api/projects returns project catalog', async () => {
    const app = buildServer({ roots: [fixturesRoot] });
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    const data = res.json() as Array<{ id: string }>;
    expect(data.length).toBeGreaterThanOrEqual(2);
    await app.close();
  });

  it('GET /api/projects/:id/wiki and /pages/:slug return content', async () => {
    const app = buildServer({ roots: [fixturesRoot] });
    const projectsRes = await app.inject({ method: 'GET', url: '/api/projects' });
    const projects = projectsRes.json() as Array<{ id: string; title: string }>;
    const project = projects.find((item) => item.title === 'Project A Wiki');

    expect(project).toBeTruthy();

    const wikiRes = await app.inject({ method: 'GET', url: `/api/projects/${project!.id}/wiki` });
    expect(wikiRes.statusCode).toBe(200);

    const pageRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project!.id}/pages/10-protobufxie-yi-ji-cheng`
    });
    expect(pageRes.statusCode).toBe(200);
    expect((pageRes.json() as { content: string }).content).toContain('Protobuf');
    await app.close();
  });
});
