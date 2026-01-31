'use client';

import { AdminProductForm, type ProductStatus, type VariantData } from '@/components/dashboard/AdminProductForm';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiResponse } from '@/types/api';

interface Product {
  id: string;
  name: string;
  slug: string;
  collection: string;
  description: string;
  images: string[];
  basePrice: number;
  minPrice: number;
  costPrice?: number | null;
  comparePrice?: number | null;
  status: ProductStatus;
  variants: VariantData[];
  tags: string[];
  deliveryTime: string;
}

export default function EditProductPage() {
  const { id } = useParams();
  const [productData, setProductData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/products/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el producto');
        const responseBody: ApiResponse<Product> = await res.json();
        setProductData(responseBody.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar el producto';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, API_URL]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <p className="text-red-500 font-medium">{error || 'Producto no encontrado'}</p>
        <Link href="/dashboard/products" className="text-zinc-600 hover:text-black underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Editar Producto</h1>
        <p className="mt-2 text-zinc-500 font-medium">
          Modifica los detalles, precios o variantes del producto.
        </p>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-12">
        <AdminProductForm initialData={productData} />
      </div>
    </div>
  );
}
