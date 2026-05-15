'use client';

import BusinessKnowledgeManager from '@/components/dashboard/BusinessKnowledgeManager';

export default function KnowledgeDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
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

      <BusinessKnowledgeManager />
    </div>
  );
}
