'use client';

import PersonalizationRequestsManager from '@/components/dashboard/PersonalizationRequestsManager';

export default function PersonalizacionesDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-5 sm:px-6 md:p-12">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-primary md:text-3xl">Solicitudes de Personalización</h1>
        <p className="mt-2 max-w-2xl font-medium text-muted">
          Revisa configuraciones, diseños y estados antes de liberar la compra final para el cliente.
        </p>
      </div>

      <PersonalizationRequestsManager />
    </div>
  );
}
