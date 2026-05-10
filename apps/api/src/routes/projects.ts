import type { FastifyInstance } from 'fastify';
import { loadProjectCatalog } from '../scanner/catalogService';

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects', async () => {
    const catalog = await loadProjectCatalog(app.wikiRoots);
    return catalog.map((project) => ({
      id: project.id,
      title: project.title,
      summary: project.summary,
      rootPath: project.rootPath,
      wikiStatus: project.wikiStatus,
      pageCount: project.pageCount,
      tags: project.tags,
      lastGeneratedAt: project.lastGeneratedAt
    }));
  });
}
