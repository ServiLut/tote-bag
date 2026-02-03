import OrdersManager from '@/components/dashboard/OrdersManager';

export default function OrdersDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Centro de Pedidos</h1>
        <p className="mt-2 text-zinc-500 font-medium max-w-2xl">
          Control de producción y logística. Filtra por corte diario (12:00 PM) para organizar el taller.
        </p>
      </div>
      <OrdersManager />
    </div>
  );
}
