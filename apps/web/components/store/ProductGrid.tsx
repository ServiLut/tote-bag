'use client';

import { Product } from '@/types/product';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from './ProductCard';
import { buildCatalogSearchParams, DEFAULT_CATALOG_MAX_PRICE } from '@/lib/catalog-filters';

interface ProductGridProps {
  products: Product[];
  showVariantIndicator?: boolean;
}

export default function ProductGrid({
  products,
  showVariantIndicator = true,
}: ProductGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clearCatalogFilters = () => {
    const params = buildCatalogSearchParams(
      {
        minPrice: 0,
        maxPrice: DEFAULT_CATALOG_MAX_PRICE,
        collections: [],
        lines: [],
        sizes: [],
        qualities: [],
        materials: [],
        status: [],
      },
      searchParams,
    );

    params.delete('page');

    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`);
  };

  if (products.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-muted border border-dashed border-theme rounded-lg">
        <p>No encontramos productos con estos filtros.</p>
        <button 
          onClick={clearCatalogFilters}
          className="mt-2 text-sm text-primary underline underline-offset-4 font-medium hover:text-accent transition-colors"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          showVariantIndicator={showVariantIndicator}
        />
      ))}
    </div>
  );
}
