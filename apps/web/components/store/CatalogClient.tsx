'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductGrid from '@/components/store/ProductGrid';
import FilterSidebar, { type FilterState } from '@/components/store/FilterSidebar';
import { Product } from '@/types/product';
import {
  areCatalogFiltersEqual,
  createDefaultCatalogFilterState,
  readCatalogFiltersFromSearchParams,
} from '@/lib/catalog-filters';
import { SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CatalogClientProps {
  initialProducts: Product[];
  initialTotal: number;
  collections: { id: string; name: string }[];
  itemsPerPage: number;
  fetchState: 'success' | 'empty' | 'error';
  searchTerm: string;
}

export default function CatalogClient({
  initialProducts,
  initialTotal,
  collections,
  itemsPerPage,
  fetchState,
  searchTerm,
}: CatalogClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>(() =>
    readCatalogFiltersFromSearchParams(
      searchParams,
      createDefaultCatalogFilterState(),
    ),
  );

  const pageParam = Number(searchParams.get('page') || '1');
  const currentPage = Number.isFinite(pageParam) && pageParam > 0
    ? Math.trunc(pageParam)
    : 1;

  useEffect(() => {
    // Sync local filter UI with URL changes without duplicating router state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((currentFilters) => {
      const nextFilters = readCatalogFiltersFromSearchParams(
        searchParams,
        currentFilters,
      );

      return areCatalogFiltersEqual(currentFilters, nextFilters)
        ? currentFilters
        : nextFilters;
    });
  }, [searchParams]);

  const totalPages = Math.ceil(initialTotal / itemsPerPage);
  const currentRangeStart = initialTotal === 0 || initialProducts.length === 0
    ? 0
    : (currentPage - 1) * itemsPerPage + 1;
  const currentRangeEnd = initialTotal === 0 || initialProducts.length === 0
    ? 0
    : currentRangeStart + initialProducts.length - 1;

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

      <FilterSidebar
        collections={collections}
        filters={filters}
        onFilterChange={(nextFilters) => {
          setFilters(nextFilters);
        }}
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
      />

      <div className="flex-1">
        <div className="mb-6 flex justify-between items-center">
          <span className="text-sm text-muted">
            {initialProducts.length > 0
              ? t('catalog_results_summary', {
                  start: currentRangeStart,
                  end: currentRangeEnd,
                  total: initialTotal,
                })
              : searchTerm
                ? t('catalog_search_results', { term: searchTerm })
                : t('catalog_empty_results')}
          </span>
        </div>

        <ProductGrid
          products={initialProducts}
          showVariantIndicator={false}
          fetchState={fetchState}
        />

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
      </div>
    </main>
  );
}
