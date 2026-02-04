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
      <div className="h-screen flex items-center justify-center bg-base">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-base">
        <p className="text-red-500 font-bold">{error || 'Producto no encontrado'}</p>
        <Link href="/dashboard/products" className="text-muted hover:text-primary font-black uppercase text-xs tracking-widest underline underline-offset-8">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-8 md:p-12 max-w-5xl mx-auto overflow-hidden bg-base">
      <div className="flex-none mb-8">
        <Link 
          href="/dashboard/products" 
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-all mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a productos
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-primary">Editar Producto</h1>
        <p className="mt-2 text-muted font-medium">
          Modifica los detalles, precios o variantes del producto.
        </p>
      </div>

      <div className="flex-1 bg-surface rounded-3xl border border-theme shadow-sm overflow-hidden mb-12">
        <AdminProductForm initialData={productData} />
      </div>
    </div>
  );
}
