import { Suspense } from 'react';
import CatalogClient from '@/components/store/CatalogClient';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catálogo de Tote Bags | Tienda Oficial',
  description: 'Explora nuestra colección de tote bags artesanales y ecológicos. Personaliza tu estilo con materiales de alta calidad.',
  openGraph: {
    title: 'Catálogo de Tote Bags | Tienda Oficial',
    description: 'Bolsos artesanales y ecológicos creados para durar.',
    type: 'website',
  },
};

const ITEMS_PER_PAGE = 12;

async function getProducts(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    
    if (!params.has('limit')) params.set('limit', ITEMS_PER_PAGE.toString());

    const res = await apiFetch(`/catalog/products?${params.toString()}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) return { products: [], total: 0 };

    const body: ApiResponse<Product[]> = await res.json();
    const total = Number(res.headers.get('x-total-count') || body.data.length);

    return { products: body.data, total };
  } catch (error) {
    console.error('Catalog fetch error:', error);
    return { products: [], total: 0 };
  }
}

async function getCollections() {
  try {
    const res = await apiFetch('/collections', {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const { products, total } = await getProducts(resolvedSearchParams);
  const collections = await getCollections();
  
  const searchTerm = typeof resolvedSearchParams.search === 'string' 
    ? resolvedSearchParams.search.trim() 
    : '';

  return (
    <>
      <div className="bg-base border-b border-theme py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">Tienda</h1>
          {searchTerm ? (
            <p className="text-muted mt-2 max-w-xl">
              Resultados para: &quot;{searchTerm}&quot;
            </p>
          ) : (
            <p className="text-muted mt-2 max-w-xl">Nuestra colección completa de tote bags.</p>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="flex justify-center py-20"><div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
        <CatalogClient 
          initialProducts={products}
          initialTotal={total}
          collections={collections}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </Suspense>
    </>
  );
}
