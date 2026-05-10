import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

type DetectionResult = {
  hasWiki: boolean;
  currentFile: string;
};

export async function detectWikiProject(projectRoot: string): Promise<DetectionResult | null> {
  const currentFile = path.join(projectRoot, '.zread', 'wiki', 'current');
  try {
    await access(currentFile);
    return { hasWiki: true, currentFile };
  } catch {
    return null;
  }
}

async function collectDirectories(root: string, maxDepth: number): Promise<string[]> {
  const result: string[] = [];
  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    result.push(current);

    const entries = await readdir(current, { withFileTypes: true });
    const childDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(current, entry.name));

    for (const child of childDirs) {
      await walk(child, depth + 1);
    }
  }

  await walk(path.resolve(root), 0);
  return result;
}

export async function scanProjects(roots: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const found: string[] = [];

  for (const root of roots) {
    const candidates = await collectDirectories(root, 4);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const detected = await detectWikiProject(candidate);
      if (detected?.hasWiki) {
        found.push(candidate);
      }
    }
  }

  return found;
}
