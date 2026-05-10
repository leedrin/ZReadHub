import { scanProjects } from './projectScanner';
import { buildProjectCatalogEntry } from './metadataExtractor';
import type { ProjectMeta } from '../types';

export async function loadProjectCatalog(roots: string[]): Promise<ProjectMeta[]> {
  const projectRoots = await scanProjects(roots);
  const results = await Promise.allSettled(projectRoots.map((root) => buildProjectCatalogEntry(root)));

  return results
    .filter((item): item is PromiseFulfilledResult<ProjectMeta> => item.status === 'fulfilled')
    .map((item) => item.value);
}
