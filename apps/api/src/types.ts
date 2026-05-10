export type WikiPage = {
  slug: string;
  title: string;
  file: string;
  section?: string;
  group?: string;
  level?: string;
};

export type WikiData = {
  id: string;
  generated_at?: string;
  language?: string;
  pages: WikiPage[];
};

export type ProjectStatus = 'ready' | 'missing' | 'stale' | 'error';

export type ProjectMeta = {
  id: string;
  title: string;
  summary: string;
  rootPath: string;
  wikiRoot: string;
  wikiVersionPath: string;
  wikiStatus: ProjectStatus;
  pageCount: number;
  lastGeneratedAt: string | null;
  tags: string[];
  pages: WikiPage[];
};

export type ServerOptions = {
  roots: string[];
};
