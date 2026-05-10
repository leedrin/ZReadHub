import { describe, expect, it } from 'vitest';

import { createSearchService } from '../src/search/searchService';

describe('search service', () => {
  it('returns cross-project hits with project and slug', async () => {
    const service = await createSearchService([
      {
        id: 'a-rag',
        projectId: 'a',
        projectTitle: 'Project A',
        slug: 'rag',
        pageTitle: 'RAG Pipeline',
        content: 'embedding retrieval'
      }
    ]);
    const hits = await service.search('retrieval');
    expect(hits[0]).toMatchObject({ projectId: 'a', slug: 'rag' });
  });
});
