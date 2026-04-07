'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductGrid from '@/components/store/ProductGrid';
import FilterSidebar, { type FilterState } from '@/components/store/FilterSidebar';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { Loader2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function CatalogPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 1000000,
    collections: [],
    lines: [],
    sizes: [],
    qualities: [],
    materials: [],
    status: [],
  });

  const searchTerm = searchParams.get('search')?.trim() || '';

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await apiFetch('/collections');
        if (res.ok) {
          const body = await res.json();
          setCollections(body.data || []);
        }
      } catch (err) {
        console.error('Error fetching collections:', err);
      }
    };
    fetchCollections();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.collections.length > 0) params.append('collection', filters.collections.join(','));
        if (filters.lines.length > 0) params.append('lines', filters.lines.join(','));
        if (filters.sizes.length > 0) params.append('sizes', filters.sizes.join(','));
        if (filters.materials.length > 0) params.append('materials', filters.materials.join(','));
        if (filters.status.length > 0) params.append('status', filters.status[0]);
        if (filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString());
        if (filters.maxPrice < 1000000) params.append('maxPrice', filters.maxPrice.toString());
        if (searchTerm) params.append('search', searchTerm);

        const res = await apiFetch(`/catalog/products?${params.toString()}`);
        if (!res.ok) throw new Error(t('catalog_load_error'));
        const responseBody: ApiResponse<Product[]> = await res.json();
        setProducts(responseBody.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(t('catalog_unavailable'));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [filters, searchTerm, t]);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return products.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [products, currentPage]);

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
                    start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    end: Math.min(currentPage * ITEMS_PER_PAGE, products.length),
                    total: products.length,
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
              <ProductGrid products={paginatedProducts} />

              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="p-2 border border-theme disabled:opacity-30 disabled:cursor-not-allowed hover:bg-theme/5 transition-colors rounded-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => {
                          setCurrentPage(page);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
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
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
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
