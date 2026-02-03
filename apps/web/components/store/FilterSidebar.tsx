'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FilterState {
  minPrice: number;
  maxPrice: number;
  collections: string[];
}

interface FilterSidebarProps {
  collections: string[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}

export default function FilterSidebar({ collections, filters, onFilterChange }: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    price: true,
    collection: true,
  });

  const toggleSection = (section: 'price' | 'collection') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCollectionChange = (collection: string) => {
    const newCollections = filters.collections.includes(collection)
      ? filters.collections.filter((c) => c !== collection)
      : [...filters.collections, collection];
    onFilterChange({ ...filters, collections: newCollections });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: Number(value) || 0 });
  };

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 pr-8 hidden lg:block border-r border-theme">
      <div>
        <h3 className="text-lg font-serif font-bold mb-6 text-primary">Filtros</h3>
      </div>

      {/* Collections Filter */}
      <div className="border-b border-theme pb-6">
        <button
          onClick={() => toggleSection('collection')}
          className="flex justify-between items-center w-full text-sm font-bold uppercase tracking-wider mb-4 text-primary"
        >
          Colección
          {openSections.collection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {openSections.collection && (
          <div className="space-y-3">
            {collections.map((collection) => (
              <label key={collection} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${filters.collections.includes(collection) ? 'bg-primary border-primary' : 'border-theme group-hover:border-primary'}`}>
                  {filters.collections.includes(collection) && <div className="w-2 h-2 bg-base" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={filters.collections.includes(collection)}
                  onChange={() => handleCollectionChange(collection)}
                />
                <span className="text-sm text-muted group-hover:text-primary transition-colors">{collection}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Price Filter */}
      <div className="border-b border-theme pb-6">
        <button
          onClick={() => toggleSection('price')}
          className="flex justify-between items-center w-full text-sm font-bold uppercase tracking-wider mb-4 text-primary"
        >
          Precio
          {openSections.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {openSections.price && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted">Min</label>
                <div className="relative">
                   <span className="absolute left-3 top-2 text-xs text-muted">$</span>
                   <input
                    type="number"
                    name="minPrice"
                    value={filters.minPrice}
                    onChange={handlePriceChange}
                    className="w-full pl-6 py-1.5 border border-theme bg-base text-primary text-sm focus:border-primary outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Max</label>
                <div className="relative">
                   <span className="absolute left-3 top-2 text-xs text-muted">$</span>
                   <input
                    type="number"
                    name="maxPrice"
                    value={filters.maxPrice}
                    onChange={handlePriceChange}
                    className="w-full pl-6 py-1.5 border border-theme bg-base text-primary text-sm focus:border-primary outline-none"
                    placeholder="999..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
