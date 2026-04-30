'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductGrid from '@/components/store/ProductGrid';
import FilterSidebar, { type FilterState } from '@/components/store/FilterSidebar';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { DEFAULT_CATALOG_MAX_PRICE } from '@/lib/catalog-filters';
import { Loader2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

async function resolveApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const body = (await response.json()) as
      | Partial<ApiResponse<unknown>>
      | { message?: string };

    if (
      'message' in body &&
      typeof body.message === 'string' &&
      body.message.trim().length > 0
    ) {
      return body.message;
    }

    if (
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.trim().length > 0
    ) {
      return body.error;
    }
  } catch {
    // Ignore body parsing errors and return the fallback below.
  }

  return fallbackMessage;
}

function CatalogPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [collections, setCollections] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const ITEMS_PER_PAGE = 12;

  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: DEFAULT_CATALOG_MAX_PRICE,
    collections: [],
    lines: [],
    sizes: [],
    qualities: [],
    materials: [],
    status: [],
  });

  const searchTerm = searchParams.get('search')?.trim() || '';
  const pageParam = Number(searchParams.get('page') || '1');
  const currentPage = Number.isFinite(pageParam) && pageParam > 0
    ? Math.trunc(pageParam)
    : 1;

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await apiFetch('/collections');
        if (res.ok) {
          const body = await res.json();
          setCollections(body.data || []);
        }
      } catch {
        // Collections are supplementary for filters; fail silently here.
      }
    };
    fetchCollections();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', currentPage.toString());
        params.set('limit', ITEMS_PER_PAGE.toString());

        const res = await apiFetch(`/catalog/products?${params.toString()}`);
        if (!res.ok) {
          const message = await resolveApiErrorMessage(
            res,
            t('catalog_unavailable'),
          );
          setProducts([]);
          setTotalProducts(0);
          setError(message);
          return;
        }

        const responseBody: ApiResponse<Product[]> = await res.json();
        setProducts(responseBody.data);
        const totalCountHeader = Number(res.headers.get('x-total-count') || '0');
        setTotalProducts(
          Number.isFinite(totalCountHeader) && totalCountHeader >= 0
            ? totalCountHeader
            : responseBody.data.length,
        );
        setError(null);
      } catch {
        setProducts([]);
        setTotalProducts(0);
        setError(t('catalog_unavailable'));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [ITEMS_PER_PAGE, currentPage, searchParams, t]);

  const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
  const currentRangeStart = totalProducts === 0 || products.length === 0
    ? 0
    : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const currentRangeEnd = totalProducts === 0 || products.length === 0
    ? 0
    : currentRangeStart + products.length - 1;

  const goToPage = (page: number) => {
    const nextPage = Math.max(page, 1);
    const params = new URLSearchParams(searchParams.toString());

    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', nextPage.toString());
    }

    const query = params.toString();
    router.push(`/catalog${query ? `?${query}` : ''}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="bg-base border-b border-theme py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">{t('catalog_title')}</h1>
          {searchTerm ? (
            <p className="text-muted mt-2 max-w-xl">
              {t('catalog_search_results', { term: searchTerm })}
            </p>
          ) : (
            <p className="text-muted mt-2 max-w-xl">{t('catalog_description')}</p>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-sm w-full justify-center text-sm font-bold uppercase tracking-wide bg-base text-primary shadow-sm active:bg-theme/5"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('catalog_filter_products')}
          </button>
        </div>

        <Suspense fallback={<div className="w-64 animate-pulse bg-slate-100 h-96 rounded-lg" />}>
          <FilterSidebar
            collections={collections}
            filters={filters}
            onFilterChange={setFilters}
            isOpen={showMobileFilters}
            onClose={() => setShowMobileFilters(false)}
          />
        </Suspense>

        <div className="flex-1">
          <div className="mb-6 flex justify-between items-center">
            <span className="text-sm text-muted">
              {products.length > 0
                ? t('catalog_results_summary', {
                    start: currentRangeStart,
                    end: currentRangeEnd,
                    total: totalProducts,
                  })
                : t('catalog_empty_results')}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : error ? (
            <div className="text-center py-20 text-accent font-medium">{error}</div>
          ) : (
            <>
              <ProductGrid products={products} showVariantIndicator={false} />

              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-theme disabled:opacity-30 disabled:cursor-not-allowed hover:bg-theme/5 transition-colors rounded-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`min-w-[40px] h-10 flex items-center justify-center border transition-colors rounded-sm text-sm font-medium ${
                          currentPage === page
                            ? 'bg-primary text-base border-primary'
                            : 'border-theme hover:bg-theme/5 text-primary'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-theme disabled:opacity-30 disabled:cursor-not-allowed hover:bg-theme/5 transition-colors rounded-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] w-full animate-pulse bg-slate-100" />}>
      <CatalogPageContent />
    </Suspense>
  );
}
