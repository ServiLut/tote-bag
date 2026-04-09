'use client';

import { AdminProductForm } from '@/components/dashboard/AdminProductForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewProductPage() {
  return (
    <div className="min-h-screen flex flex-col p-8 md:p-12 max-w-5xl mx-auto bg-base">
      <div className="flex-none mb-8">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-all mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a productos
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-primary">Crear nuevo producto</h1>
        <p className="mt-2 text-muted font-medium">
          Define la información base, los precios y las variantes del nuevo producto.
        </p>
      </div>

      <div className="bg-surface rounded-3xl border border-theme shadow-sm mb-12">
        <AdminProductForm />
      </div>
    </div>
  );
}
