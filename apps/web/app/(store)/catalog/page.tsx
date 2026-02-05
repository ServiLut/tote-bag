'use client';

import { useState, useEffect, useMemo } from 'react';
import ProductGrid from '@/components/store/ProductGrid';
import FilterSidebar from '@/components/store/FilterSidebar';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { Loader2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

interface FilterState {
  minPrice: number;
  maxPrice: number;
  collections: string[];
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mobile filter toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 1000000,
    collections: [],
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/products/list`);
        if (!res.ok) throw new Error('Error al cargar catálogo');
        const responseBody: ApiResponse<Product[]> = await res.json();
        setProducts(responseBody.data);
      } catch (err) {
        console.error(err);
        setError('No pudimos cargar el catálogo.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL]);

  // Extract unique collections from products for the filter
  const availableCollections = useMemo(() => {
    const collections = new Set<string>();
    products.forEach(p => {
      if (p.collection?.name) collections.add(p.collection.name);
    });
    return Array.from(collections);
  }, [products]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // 1. Price Filter
      if (product.basePrice < filters.minPrice) return false;
      if (filters.maxPrice > 0 && product.basePrice > filters.maxPrice) return false;

      // 2. Collection Filter
      if (filters.collections.length > 0) {
        if (!product.collection?.name || !filters.collections.includes(product.collection.name)) {
          return false;
        }
      }

      return true;
    });
  }, [products, filters]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  return (
    <>
      {/* Header */}
      <div className="bg-base border-b border-theme py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif text-primary">Catálogo</h1>
          <p className="text-muted mt-2 max-w-xl">
            Explora nuestra colección completa de tote bags sostenibles. 
            Diseñadas para reducir el uso de plástico sin sacrificar tu estilo.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">
        
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-sm w-full justify-center text-sm font-bold uppercase tracking-wide bg-base text-primary shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showMobileFilters ? 'Ocultar Filtros' : 'Filtrar Productos'}
          </button>
        </div>

        {/* Filters Sidebar (Desktop + Mobile logic) */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
          <FilterSidebar 
            collections={availableCollections} 
            filters={filters} 
            onFilterChange={setFilters} 
          />
        </div>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="mb-6 flex justify-between items-center">
            <span className="text-sm text-muted">
              {filteredProducts.length > 0 ? (
                <>
                  Mostrando <span className="text-primary font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="text-primary font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}</span> de <span className="text-primary font-medium">{filteredProducts.length}</span> productos
                </>
              ) : (
                'No se encontraron productos'
              )}
            </span>
            {/* Sort Dropdown could go here */}
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
              
              {/* Pagination UI */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="p-2 border border-theme disabled:opacity-30 disabled:cursor-not-allowed hover:bg-theme/5 transition-colors rounded-sm"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0">
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
                    aria-label="Siguiente página"
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
