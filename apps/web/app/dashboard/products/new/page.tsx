'use client';

import { AdminProductForm } from '@/components/dashboard/AdminProductForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewProductPage() {
  return (
    <div className="h-screen flex flex-col p-8 md:p-12 max-w-5xl mx-auto overflow-hidden">
      <div className="flex-none mb-8">
        <Link 
          href="/dashboard/products" 
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a productos
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Crear Nuevo Producto</h1>
        <p className="mt-2 text-zinc-500 font-medium">
          Define la información base, precios y variantes del nuevo diseño.
        </p>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-12">
        <AdminProductForm />
      </div>
    </div>
  );
}
