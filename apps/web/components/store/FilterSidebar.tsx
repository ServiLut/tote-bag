'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CATALOG_ATTRIBUTES } from '@/utils/catalog-constants';

export interface FilterState {
  minPrice: number;
  maxPrice: number;
  collections: string[];
  lines: string[];
  sizes: string[];
  qualities: string[];
  materials: string[];
  status: string[];
}

interface FilterSidebarProps {
  collections: { id: string, name: string }[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}

export default function FilterSidebar({ collections, filters, onFilterChange }: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    price: true,
    collection: true,
    line: true,
    attributes: true,
    availability: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCheckboxChange = (field: keyof FilterState, value: string) => {
    const currentValues = filters[field] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFilterChange({ ...filters, [field]: newValues });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: Number(value) || 0 });
  };

  const renderCheckboxGroup = (title: string, field: keyof FilterState, options: string[], section: keyof typeof openSections) => (
    <div className="border-b border-theme pb-6">
      <button
        onClick={() => toggleSection(section)}
        className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary"
      >
        {title}
        {openSections[section] ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
      </button>
      
      {openSections[section] && (
        <div className="space-y-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 border flex items-center justify-center transition-all rounded-sm ${
                (filters[field] as string[]).includes(opt) 
                  ? 'bg-primary border-primary' 
                  : 'border-theme group-hover:border-primary'
              }`}>
                {(filters[field] as string[]).includes(opt) && (
                  <div className="w-1.5 h-1.5 bg-base-color" />
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={(filters[field] as string[]).includes(opt)}
                onChange={() => handleCheckboxChange(field, opt)}
              />
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
                {opt}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const renderCollectionGroup = () => (
    <div className="border-b border-theme pb-6">
      <button
        onClick={() => toggleSection('collection')}
        className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary"
      >
        Colecciones
        {openSections.collection ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
      </button>
      
      {openSections.collection && (
        <div className="space-y-3">
          {collections.map((coll) => (
            <label key={coll.id} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 border flex items-center justify-center transition-all rounded-sm ${
                filters.collections.includes(coll.id) 
                  ? 'bg-primary border-primary' 
                  : 'border-theme group-hover:border-primary'
              }`}>
                {filters.collections.includes(coll.id) && (
                  <div className="w-1.5 h-1.5 bg-base-color" />
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={filters.collections.includes(coll.id)}
                onChange={() => handleCheckboxChange('collections', coll.id)}
              />
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
                {coll.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 pr-8 hidden lg:block border-r border-theme">
      <div>
        <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-10 text-primary flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
          Filtros
        </h3>
      </div>

      {/* Brand Lines */}
      {renderCheckboxGroup('Líneas', 'lines', [...CATALOG_ATTRIBUTES.LINE], 'line')}

      {/* Collections */}
      {renderCollectionGroup()}

      {/* Attributes Group */}
      <div className="border-b border-theme pb-6">
        <button
          onClick={() => toggleSection('attributes')}
          className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary"
        >
          Características
          {openSections.attributes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>
        {openSections.attributes && (
          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">Tamaño</p>
              <div className="space-y-2">
                {CATALOG_ATTRIBUTES.SIZE.map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.sizes.includes(s)} 
                      onChange={() => handleCheckboxChange('sizes', s)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">Calidad</p>
              <div className="space-y-2">
                {CATALOG_ATTRIBUTES.QUALITY.map(q => (
                  <label key={q} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.qualities.includes(q)} 
                      onChange={() => handleCheckboxChange('qualities', q)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{q}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">Material</p>
              <div className="space-y-2">
                {CATALOG_ATTRIBUTES.MATERIAL.map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.materials.includes(m)} 
                      onChange={() => handleCheckboxChange('materials', m)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Price Filter */}
      <div className="border-b border-theme pb-6">
        <button
          onClick={() => toggleSection('price')}
          className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary"
        >
          Rango de Precio
          {openSections.price ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>
        {openSections.price && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <label className="text-[9px] font-black uppercase text-muted tracking-widest opacity-60">Min</label>
                <div className="relative">
                   <span className="absolute left-3 top-2 text-[10px] font-bold text-muted">$</span>
                   <input
                    type="number"
                    name="minPrice"
                    value={filters.minPrice}
                    onChange={handlePriceChange}
                    className="w-full pl-6 py-2 border border-theme bg-base text-primary text-xs font-bold focus:border-primary outline-none transition-all rounded-lg"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-[9px] font-black uppercase text-muted tracking-widest opacity-60">Max</label>
                <div className="relative">
                   <span className="absolute left-3 top-2 text-[10px] font-bold text-muted">$</span>
                   <input
                    type="number"
                    name="maxPrice"
                    value={filters.maxPrice}
                    onChange={handlePriceChange}
                    className="w-full pl-6 py-2 border border-theme bg-base text-primary text-xs font-bold focus:border-primary outline-none transition-all rounded-lg"
                    placeholder="999..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Availability Filter */}
      {renderCheckboxGroup('Disponibilidad', 'status', ['DISPONIBLE', 'BAJO_PEDIDO'], 'availability')}
    </aside>
  );
}
