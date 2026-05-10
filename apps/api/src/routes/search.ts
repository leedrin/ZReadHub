import type { FastifyInstance } from 'fastify';
import { loadProjectCatalog } from '../scanner/catalogService';
import { buildSearchDocuments } from '../search/indexBuilder';
import { createSearchService } from '../search/searchService';

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (request) => {
    const { q = '' } = request.query as { q?: string };
    const catalog = await loadProjectCatalog(app.wikiRoots);
    const docs = await buildSearchDocuments(catalog);
    const service = await createSearchService(docs);
    return service.search(q);
  });
}
