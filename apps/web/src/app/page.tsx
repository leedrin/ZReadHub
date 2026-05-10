import { ProjectGrid } from '@/components/dashboard/ProjectGrid';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Wiki Hub</h1>
      <p className="mt-2 text-sm text-neutral-600">Aggregate local zread wiki projects with fast cross-project navigation.</p>
      <ProjectGrid />
    </main>
  );
}