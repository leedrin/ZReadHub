import type { ProjectMeta, SearchHit, WikiPageContent, WikiTree } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  getProjects: () => request<ProjectMeta[]>('/projects'),
  getWiki: (projectId: string) => request<WikiTree>(`/projects/${projectId}/wiki`),
  getPage: (projectId: string, slug: string) => request<WikiPageContent>(`/projects/${projectId}/pages/${slug}`),
  search: (query: string) => request<SearchHit[]>(`/search?q=${encodeURIComponent(query)}`)
};
