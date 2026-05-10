import FlexSearch from 'flexsearch';
import type { SearchDocument } from './indexBuilder';

export type SearchHit = {
  projectId: string;
  projectTitle: string;
  slug: string;
  pageTitle: string;
  snippet: string;
};

type EnrichedBucket = {
  field: string;
  result: Array<{ id: string; doc: SearchDocument }>;
};

export async function createSearchService(docs: SearchDocument[]) {
  const index = new FlexSearch.Document<SearchDocument, true>({
    document: {
      id: 'id',
      index: ['projectTitle', 'pageTitle', 'content'],
      store: true
    },
    tokenize: 'forward'
  });

  docs.forEach((doc) => {
    index.add(doc);
  });

  return {
    async search(query: string): Promise<SearchHit[]> {
      if (!query.trim()) return [];

      const buckets = (await index.search(query, { limit: 20, enrich: true })) as EnrichedBucket[];
      const unique = new Map<string, SearchDocument>();
      for (const bucket of buckets) {
        for (const row of bucket.result) {
          unique.set(row.id, row.doc);
        }
      }

      return Array.from(unique.values()).map((doc) => ({
        projectId: doc.projectId,
        projectTitle: doc.projectTitle,
        slug: doc.slug,
        pageTitle: doc.pageTitle,
        snippet: doc.content.slice(0, 180)
      }));
    }
  };
}
