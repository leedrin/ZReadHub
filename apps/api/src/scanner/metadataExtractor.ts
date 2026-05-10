import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectMeta } from '../types';
import { readWikiData, resolveCurrentWikiVersionPath } from './wikiResolver';

function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

function createProjectId(projectRoot: string): string {
  return createHash('sha1').update(path.resolve(projectRoot)).digest('hex').slice(0, 12);
}

async function readProjectTitle(projectRoot: string): Promise<string> {
  try {
    const readme = stripBom(await readFile(path.join(projectRoot, 'README.md'), 'utf8'));
    const titleLine = readme
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('#'))
      ?.replace(/^#+\s*/, '')
      .trim();
    return titleLine || path.basename(projectRoot);
  } catch {
    return path.basename(projectRoot);
  }
}

async function readProjectSummary(projectRoot: string): Promise<string> {
  try {
    const readme = stripBom(await readFile(path.join(projectRoot, 'README.md'), 'utf8'));
    const lines = readme.split(/\r?\n/).map((line) => line.trim());
    const summary = lines.find((line) => line && !line.startsWith('#'));
    return summary || 'Auto extracted from local zread wiki';
  } catch {
    return 'Auto extracted from local zread wiki';
  }
}

export async function buildProjectCatalogEntry(projectRoot: string): Promise<ProjectMeta> {
  const wikiVersionPath = await resolveCurrentWikiVersionPath(projectRoot);
  const wiki = await readWikiData(wikiVersionPath);

  return {
    id: createProjectId(projectRoot),
    title: await readProjectTitle(projectRoot),
    summary: await readProjectSummary(projectRoot),
    rootPath: path.resolve(projectRoot),
    wikiRoot: path.join(path.resolve(projectRoot), '.zread', 'wiki'),
    wikiVersionPath,
    wikiStatus: 'ready',
    pageCount: wiki.pages.length,
    lastGeneratedAt: wiki.generated_at ?? null,
    tags: Array.from(new Set(wiki.pages.map((page) => page.section).filter((item): item is string => Boolean(item)))),
    pages: wiki.pages
  };
}
