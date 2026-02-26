'use client';

import PersonalizationManager from '@/components/dashboard/PersonalizationManager';

export default function PersonalizationsDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Gestión de Personalizaciones</h1>
          <p className="mt-2 text-muted font-medium max-w-2xl">
            Configura los precios base y materiales permitidos para cada técnica de personalización de forma global.
          </p>
        </div>
      </div>
      <PersonalizationManager />
    </div>
  );
}
