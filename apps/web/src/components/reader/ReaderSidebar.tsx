import Link from 'next/link';
import type { WikiTree } from '@/lib/types';

export function ReaderSidebar({
  projectId,
  wiki,
  activeSlug
}: {
  projectId: string;
  wiki: WikiTree;
  activeSlug: string;
}) {
  return (
    <aside data-testid="reader-sidebar" className="h-screen overflow-y-auto border-r border-neutral-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">{wiki.title}</h2>
      <nav className="space-y-1">
        {wiki.pages.map((page) => (
          <Link
            key={page.slug}
            href={`/reader/${projectId}/${page.slug}`}
            className={`block rounded-lg px-3 py-2 text-sm ${
              activeSlug === page.slug ? 'bg-sky-100 text-sky-900' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {page.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
