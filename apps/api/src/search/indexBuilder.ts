import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectMeta } from '../types';

export type SearchDocument = {
  id: string;
  projectId: string;
  projectTitle: string;
  slug: string;
  pageTitle: string;
  content: string;
};

export async function buildSearchDocuments(projects: ProjectMeta[]): Promise<SearchDocument[]> {
  const documents: SearchDocument[] = [];

  for (const project of projects) {
    for (const page of project.pages) {
      const filePath = path.join(project.wikiVersionPath, page.file);
      const content = await readFile(filePath, 'utf8');
      documents.push({
        id: `${project.id}:${page.slug}`,
        projectId: project.id,
        projectTitle: project.title,
        slug: page.slug,
        pageTitle: page.title,
        content
      });
    }
  }

  return documents;
}
