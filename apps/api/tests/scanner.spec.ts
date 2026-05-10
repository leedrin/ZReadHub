import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isPathInsideRoots } from '../src/utils/pathSafety';
import { detectWikiProject, scanProjects } from '../src/scanner/projectScanner';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('path safety', () => {
  it('allows paths under approved roots', () => {
    const target = path.join(fixturesRoot, 'project-a', '.zread', 'wiki', 'current');
    expect(isPathInsideRoots(target, [fixturesRoot])).toBe(true);
  });

  it('blocks traversal outside approved roots', () => {
    const target = path.resolve(fixturesRoot, '..', '..', '..');
    expect(isPathInsideRoots(target, [path.join(fixturesRoot, 'project-a')])).toBe(false);
  });
});

describe('project discovery', () => {
  it('detects a project when .zread/wiki/current exists', async () => {
    const result = await detectWikiProject(path.join(fixturesRoot, 'project-a'));
    expect(result?.hasWiki).toBe(true);
  });

  it('scans multiple projects from root', async () => {
    const projects = await scanProjects([fixturesRoot]);
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });
});
