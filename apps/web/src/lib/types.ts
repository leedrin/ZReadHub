export type ProjectMeta = {
  id: string;
  title: string;
  summary: string;
  rootPath: string;
  wikiStatus: 'ready' | 'missing' | 'stale' | 'error';
  pageCount: number;
  tags: string[];
  lastGeneratedAt: string | null;
};

export type WikiPage = {
  slug: string;
  title: string;
  file: string;
  section?: string;
  group?: string;
  level?: string;
};

export type WikiTree = {
  id: string;
  title: string;
  generated_at: string | null;
  pages: WikiPage[];
};

export type WikiPageContent = {
  projectId: string;
  projectTitle: string;
  slug: string;
  title: string;
  section?: string;
  group?: string;
  content: string;
};

export type SearchHit = {
  projectId: string;
  projectTitle: string;
  slug: string;
  pageTitle: string;
  snippet: string;
};
