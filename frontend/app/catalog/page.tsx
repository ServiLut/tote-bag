'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/store/Navbar';
import CartDrawer from '@/components/store/CartDrawer';
import ProductGrid from '@/components/store/ProductGrid';
import FilterSidebar from '@/components/store/FilterSidebar';
import Footer from '@/components/store/Footer';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { Loader2, SlidersHorizontal } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex flex-col bg-base transition-colors duration-300">
      <Navbar />
      <CartDrawer />

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
              Mostrando {filteredProducts.length} producto(s)
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
            <ProductGrid products={filteredProducts} />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
