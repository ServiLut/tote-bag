import OrdersManager from '@/components/dashboard/OrdersManager';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function OrdersDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Centro de Pedidos</h1>
          <p className="mt-2 text-muted font-medium max-w-2xl">
            Control de producción y logística. Filtra por corte diario (12:00 PM) para organizar el taller.
          </p>
        </div>
        <Link 
          href="/dashboard/orders/new"
          className="px-6 py-4 bg-primary text-base-color font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pedido
        </Link>
      </div>
      <OrdersManager />
    </div>
  );
}
