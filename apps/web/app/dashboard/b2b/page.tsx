import B2BQuotesManager from '@/components/dashboard/B2BQuotesManager';

export default function B2BDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Solicitudes Corporativas (B2B)</h1>
        <p className="mt-2 text-zinc-500 font-medium max-w-2xl">
          Gestión de cotizaciones masivas. Revisa los logos y aprueba los diseños para iniciar producción.
        </p>
      </div>
      <B2BQuotesManager />
    </div>
  );
}
