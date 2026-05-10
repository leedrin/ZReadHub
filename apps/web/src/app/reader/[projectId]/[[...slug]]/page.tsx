'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MarkdownView } from '@/components/reader/MarkdownView';
import { ReaderSidebar } from '@/components/reader/ReaderSidebar';
import { apiClient } from '@/lib/apiClient';
import type { WikiPageContent, WikiTree } from '@/lib/types';

export default function ReaderPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; slug?: string[] }>();
  const projectId = params.projectId;
  const routeSlug = params.slug?.[0];

  const [wiki, setWiki] = useState<WikiTree | null>(null);
  const [page, setPage] = useState<WikiPageContent | null>(null);

  useEffect(() => {
    if (!projectId) return;

    apiClient
      .getWiki(projectId)
      .then((wikiData) => {
        setWiki(wikiData);
        const activeSlug = routeSlug ?? wikiData.pages[0]?.slug;
        if (!activeSlug) return;
        if (!routeSlug) {
          router.replace(`/reader/${projectId}/${activeSlug}`);
        }
        return apiClient.getPage(projectId, activeSlug).then(setPage);
      })
      .catch(() => {
        setWiki(null);
        setPage(null);
      });
  }, [projectId, routeSlug, router]);

  if (!wiki || !page) {
    return <main className="p-6 text-sm text-neutral-600">Loading wiki...</main>;
  }

  const activeSlug = routeSlug ?? wiki.pages[0]!.slug;

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[320px_1fr]">
      <ReaderSidebar projectId={projectId} wiki={wiki} activeSlug={activeSlug} />
      <section className="px-6 py-8 md:px-10">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{page.title}</h1>
        <MarkdownView content={page.content} />
      </section>
    </main>
  );
}