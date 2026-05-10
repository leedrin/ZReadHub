'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import type { SearchHit } from '@/lib/types';

export function GlobalSearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    apiClient.search(query).then(setResults).catch(() => setResults([]));
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4 md:p-10" onClick={() => setOpen(false)}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          placeholder="Search all wiki pages"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-3 space-y-2">
          {results.map((item) => (
            <button
              key={`${item.projectId}:${item.slug}`}
              data-testid="global-search-result"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left hover:bg-neutral-50"
              onClick={() => {
                setOpen(false);
                router.push(`/reader/${item.projectId}/${item.slug}`);
              }}
            >
              <div className="text-sm font-medium text-neutral-900">{item.pageTitle}</div>
              <div className="text-xs text-neutral-500">{item.projectTitle}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
