'use client';

import BusinessKnowledgeManager from '@/components/dashboard/BusinessKnowledgeManager';

export default function KnowledgeDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="rounded-[36px] border border-theme bg-surface p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(141,161,104,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,rgba(16,18,24,0.98),rgba(9,11,15,0.99))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">
            Centro Informativo
          </h1>
          <p className="mt-2 max-w-3xl font-medium text-muted">
            Informacion clave del negocio, noticias internas, reglas comerciales y datos importantes para ventas y operacion.
          </p>
        </div>
        </div>
      </div>

      <BusinessKnowledgeManager />
    </div>
  );
}
