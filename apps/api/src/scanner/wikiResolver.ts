import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { WikiData } from '../types';

function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

export async function resolveCurrentWikiVersionPath(projectRoot: string): Promise<string> {
  const currentFile = path.join(projectRoot, '.zread', 'wiki', 'current');
  const pointer = stripBom(await readFile(currentFile, 'utf8')).trim();
  return path.resolve(path.join(projectRoot, '.zread', 'wiki', pointer));
}

export async function readWikiData(wikiVersionPath: string): Promise<WikiData> {
  const wikiJsonPath = path.join(wikiVersionPath, 'wiki.json');
  const content = stripBom(await readFile(wikiJsonPath, 'utf8'));
  return JSON.parse(content) as WikiData;
}
