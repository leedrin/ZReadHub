'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { ProjectMeta } from '@/lib/types';
import { ProjectCard } from './ProjectCard';

export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiClient.getProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((item) => item.title.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <section className="mt-8">
      <input
        placeholder="Search projects"
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
