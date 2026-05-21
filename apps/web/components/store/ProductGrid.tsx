'use client';

import { Product } from '@/types/product';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from './ProductCard';
import { buildCatalogSearchParams, DEFAULT_CATALOG_MAX_PRICE } from '@/lib/catalog-filters';
import { useTranslation } from 'react-i18next';
import { buildStorefrontWhatsAppUrl } from '@/lib/whatsapp';

interface ProductGridProps {
  products: Product[];
  showVariantIndicator?: boolean;
  fetchState?: 'success' | 'empty' | 'error';
}

export default function ProductGrid({
  products,
  showVariantIndicator = true,
  fetchState = 'success',
}: ProductGridProps) {
  const { t } = useTranslation();
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
    const hasActiveFilters = ['collection', 'lines', 'sizes', 'materials', 'status', 'minPrice', 'maxPrice']
      .some((key) => {
        const value = searchParams.get(key);
        return typeof value === 'string' && value.trim().length > 0;
      });
    const hasSearchTerm = !!searchParams.get('search')?.trim();
    const title = fetchState === 'error'
      ? t('catalog_error_title')
      : hasActiveFilters || hasSearchTerm
        ? t('catalog_empty_title')
        : t('catalog_no_stock_title');
    const description = fetchState === 'error'
      ? t('catalog_error_description')
      : hasActiveFilters || hasSearchTerm
        ? t('catalog_empty_description')
        : t('catalog_no_stock_description');

    return (
      <div className="w-full rounded-[2rem] border border-dashed border-theme bg-surface px-6 py-12 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">
          {fetchState === 'error' ? t('catalog_error_badge') : t('catalog_empty_badge')}
        </p>
        <h3 className="mt-4 text-2xl font-serif font-bold text-primary">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted">
          {description}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {hasActiveFilters || hasSearchTerm ? (
            <button
              onClick={clearCatalogFilters}
              className="rounded-xl border border-theme px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-base"
            >
              {t('catalog_clear_filters')}
            </button>
          ) : null}
          <Link
            href="/personaliza"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-base-color transition-opacity hover:opacity-90"
          >
            {t('catalog_empty_cta_customize')}
          </Link>
          <Link
            href={buildStorefrontWhatsAppUrl('catalog')}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-green-500 px-5 py-3 text-sm font-bold text-green-700 transition-colors hover:bg-green-50"
          >
            {t('catalog_empty_cta_whatsapp')}
          </Link>
        </div>
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
