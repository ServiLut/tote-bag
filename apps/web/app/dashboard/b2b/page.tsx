'use client';

import B2BPricingSimulator from '@/components/dashboard/B2BPricingSimulator';
import B2BQuotesManager from '@/components/dashboard/B2BQuotesManager';

export default function B2BDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">
            Solicitudes Corporativas (B2B)
          </h1>
          <p className="mt-2 max-w-2xl font-medium text-muted">
            Gestion de cotizaciones masivas. Revisa los logos y aprueba los disenos para iniciar produccion.
          </p>
        </div>
        <B2BPricingSimulator />
      </div>

      <B2BQuotesManager />
    </div>
  );
}
