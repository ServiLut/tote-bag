import ProductsTable from '@/components/dashboard/ProductsTable';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function ProductsDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Gestión de Productos</h1>
          <p className="mt-2 text-muted font-medium max-w-2xl">
            Administra el catálogo, precios y estados. Las alertas visuales indican márgenes reducidos.
          </p>
        </div>
        <Link 
          href="/dashboard/products/new"
          className="inline-flex items-center justify-center gap-2 bg-primary text-base-color px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </Link>
      </div>
      <ProductsTable />
    </div>
  );
}
