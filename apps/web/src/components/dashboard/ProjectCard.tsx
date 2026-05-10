import Link from 'next/link';
import type { ProjectMeta } from '@/lib/types';

export function ProjectCard({ project }: { project: ProjectMeta }) {
  return (
    <Link
      data-testid="project-card"
      href={`/reader/${project.id}`}
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-neutral-900">{project.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{project.summary}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
        <span>{project.pageCount} pages</span>
        <span>{project.wikiStatus}</span>
      </div>
    </Link>
  );
}
