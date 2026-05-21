'use client';

import OrdersManager from '@/components/dashboard/OrdersManager';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function OrdersDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-5 sm:px-6 md:p-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary md:text-3xl">Centro de Pedidos</h1>
          <p className="mt-2 text-muted font-medium max-w-2xl">
            Control de producción y logística. Filtra por corte diario (12:00 PM) para organizar el taller.
          </p>
        </div>
        <Link
          href="/dashboard/orders/new"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pedido
        </Link>
      </div>
      <OrdersManager />
    </div>
  );
}
