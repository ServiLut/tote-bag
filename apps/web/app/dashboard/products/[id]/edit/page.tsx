'use client';

import {
  AdminProductForm,
  type ProductStatus,
  type VariantData,
  type AttributeData,
  type PricingRuleData,
  type PrintType,
} from '@/components/dashboard/AdminProductForm';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { createClient } from '@/utils/supabase/client';

interface Product {
  id: string;
  name: string;
  slug: string;
  collection: string | { id: string; name: string };
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  material?: string;
  dimensions?: string;
  careInstructions?: string;
  printType?: PrintType;
  images: Array<string | { id?: string; url: string; position?: number }>;
  status: ProductStatus;
  variants: VariantData[];
  tags: string[];
  deliveryTime: string;
  attributes?: Array<AttributeData & { type: 'SIZE' | AttributeData['type'] }>;
  pricingRules?: PricingRuleData[];
}

export default function EditProductPage() {
  const { id } = useParams();
  const { accessToken } = useDashboardAuth();
  const [productData, setProductData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? accessToken;

        if (!token) {
          throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
        }

        const res = await apiFetch(`/catalog/admin/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error(
            'No tienes permisos para editar productos con esta sesion.',
          );
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el producto');
        }

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
  }, [accessToken, id, supabase.auth]);

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
    <div className="min-h-screen flex flex-col p-8 md:p-12 max-w-5xl mx-auto bg-base">
      <div className="flex-none mb-8">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-all mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a productos
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-primary">Editar producto</h1>
        <p className="mt-2 text-muted font-medium">
          Modifica la información general, las variantes comerciales y las configuraciones opcionales del producto.
        </p>
      </div>

      <div className="bg-surface rounded-3xl border border-theme shadow-sm mb-12">
        <AdminProductForm initialData={productData} />
      </div>
    </div>
  );
}
