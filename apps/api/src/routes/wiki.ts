import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { loadProjectCatalog } from '../scanner/catalogService';

function findProjectById(id: string, catalog: Awaited<ReturnType<typeof loadProjectCatalog>>) {
  return catalog.find((project) => project.id === id);
}

export async function registerWikiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects/:id/wiki', async (request, reply) => {
    const { id } = request.params as { id: string };
    const catalog = await loadProjectCatalog(app.wikiRoots);
    const project = findProjectById(id, catalog);

    if (!project) {
      return reply.code(404).send({ message: 'Project not found' });
    }

    return {
      id: project.id,
      title: project.title,
      generated_at: project.lastGeneratedAt,
      pages: project.pages
    };
  });

  app.get('/projects/:id/pages/:slug', async (request, reply) => {
    const { id, slug } = request.params as { id: string; slug: string };
    const catalog = await loadProjectCatalog(app.wikiRoots);
    const project = findProjectById(id, catalog);

    if (!project) {
      return reply.code(404).send({ message: 'Project not found' });
    }

    const page = project.pages.find((entry) => entry.slug === slug);
    if (!page) {
      return reply.code(404).send({ message: 'Page not found' });
    }

    const content = await readFile(path.join(project.wikiVersionPath, page.file), 'utf8');

    return {
      projectId: project.id,
      projectTitle: project.title,
      slug: page.slug,
      title: page.title,
      section: page.section,
      group: page.group,
      content
    };
  });
}
