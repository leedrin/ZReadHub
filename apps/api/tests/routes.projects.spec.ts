import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildProjectCatalogEntry } from '../src/scanner/metadataExtractor';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('catalog normalization', () => {
  it('maps wiki.json into dashboard-safe metadata', async () => {
    const entry = await buildProjectCatalogEntry(path.join(fixturesRoot, 'project-a'));
    expect(entry.title).toBe('Project A Wiki');
    expect(entry.pageCount).toBe(2);
    expect(entry.wikiStatus).toBe('ready');
    expect(entry.lastGeneratedAt).toBe('2026-05-10T04:41:51.7395171Z');
  });
});
