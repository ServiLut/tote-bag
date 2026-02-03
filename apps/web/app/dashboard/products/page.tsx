import ProductsTable from '@/components/dashboard/ProductsTable';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function ProductsDashboardPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Gestión de Productos</h1>
          <p className="mt-2 text-zinc-500 font-medium max-w-2xl">
            Administra el catálogo, precios y estados. Las alertas visuales indican márgenes reducidos.
          </p>
        </div>
        <Link 
          href="/dashboard/products/new"
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </Link>
      </div>
      <ProductsTable />
    </div>
  );
}
