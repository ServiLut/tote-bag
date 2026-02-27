'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial fallback mapping from static constants
  const initialWizardOptions = {
    LINE: (CATALOG_ATTRIBUTES?.LINE || []).map(name => ({ id: name, name, code: name })),
    DIMENSION: (CATALOG_ATTRIBUTES?.SIZE || []).map(name => ({ id: name, name, code: name })),
    QUALITY: (CATALOG_ATTRIBUTES?.QUALITY || []).map(name => ({ id: name, name, code: name })),
    MATERIAL: (CATALOG_ATTRIBUTES?.MATERIAL || []).map(name => ({ id: name, name, code: name })),
  };

  const [wizardOptions, setWizardOptions] = useState<Record<string, Array<{ id: string, name: string, code: string }>>>(initialWizardOptions);

  const [openSections, setOpenSections] = useState({
    price: true,
    collection: true,
    line: true,
    attributes: true,
    availability: true,
  });

  const updateURL = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams();
    if (newFilters.collections.length > 0) params.set('collection', newFilters.collections.join(','));
    if (newFilters.lines.length > 0) params.set('lines', newFilters.lines.join(','));
    if (newFilters.sizes.length > 0) params.set('sizes', newFilters.sizes.join(','));
    if (newFilters.qualities.length > 0) params.set('qualities', newFilters.qualities.join(','));
    if (newFilters.materials.length > 0) params.set('materials', newFilters.materials.join(','));
    if (newFilters.status.length > 0) params.set('status', newFilters.status.join(','));
    
    if (newFilters.minPrice > 0) params.set('minPrice', newFilters.minPrice.toString());
    if (newFilters.maxPrice < 1000000) params.set('maxPrice', newFilters.maxPrice.toString());

    const query = params.toString();
    router.push(`${window.location.pathname}${query ? '?' + query : ''}`, { scroll: false });
  }, [router]);

  // Sync state from URL on initial load
  useEffect(() => {
    const newFilters = { ...filters };
    let hasChanges = false;

    const sync = (key: string, field: Extract<keyof FilterState, 'collections' | 'lines' | 'sizes' | 'qualities' | 'materials' | 'status'>) => {
      const val = searchParams.get(key);
      if (val) {
        (newFilters[field] as string[]) = val.split(',');
        hasChanges = true;
      }
    };

    sync('collection', 'collections');
    sync('lines', 'lines');
    sync('sizes', 'sizes');
    sync('qualities', 'qualities');
    sync('materials', 'materials');
    sync('status', 'status');

    const minP = searchParams.get('minPrice');
    if (minP) {
      newFilters.minPrice = Number(minP);
      hasChanges = true;
    }
    const maxP = searchParams.get('maxPrice');
    if (maxP) {
      newFilters.maxPrice = Number(maxP);
      hasChanges = true;
    }

    if (hasChanges) {
      onFilterChange(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only once on mount

  useEffect(() => {
    const fetchWizardOptions = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
        const res = await fetch(`${apiUrl}/wizard-options/grouped`);
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          console.log('Filtros recibidos:', data);
          setWizardOptions(data);
        }
      } catch (err) {
        console.error('Error fetching wizard options:', err);
      }
    };
    fetchWizardOptions();
  }, []);

  // Debounced URL update for price
  useEffect(() => {
    const timer = setTimeout(() => {
      updateURL(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters, updateURL]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCheckboxChange = (field: keyof FilterState, value: string) => {
    const currentValues = filters[field] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    
    const nextFilters = { ...filters, [field]: newValues };
    onFilterChange(nextFilters);
    updateURL(nextFilters);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: Number(value) || 0 });
  };

  const blockInvalidChar = (e: React.KeyboardEvent) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault();
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
      {renderCheckboxGroup('Líneas', 'lines', (wizardOptions.LINE || []).length > 0 ? (wizardOptions.LINE || []).map(l => l.name) : [], 'line')}

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
                {(wizardOptions.DIMENSION || []).length > 0 ? (wizardOptions.DIMENSION || []).map(dim => (
                  <label key={dim.id} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.sizes.includes(dim.name)} 
                      onChange={() => handleCheckboxChange('sizes', dim.name)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{dim.name}</span>
                  </label>
                )) : (
                  <p className="text-[10px] text-muted italic">Sin opciones disponibles</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">Calidad</p>
              <div className="space-y-2">
                {(wizardOptions.QUALITY || []).length > 0 ? (wizardOptions.QUALITY || []).map(q => (
                  <label key={q.id} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.qualities.includes(q.name)} 
                      onChange={() => handleCheckboxChange('qualities', q.name)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{q.name}</span>
                  </label>
                )) : (
                  <p className="text-[10px] text-muted italic">Sin opciones disponibles</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">Material</p>
              <div className="space-y-2">
                {(wizardOptions.MATERIAL || []).length > 0 ? (wizardOptions.MATERIAL || []).map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-primary border-theme" 
                      checked={filters.materials.includes(m.name)} 
                      onChange={() => handleCheckboxChange('materials', m.name)} 
                    />
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{m.name}</span>
                  </label>
                )) : (
                  <p className="text-[10px] text-muted italic">Sin opciones disponibles</p>
                )}
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
                    min={0}
                    onKeyDown={blockInvalidChar}
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
                    min={0}
                    onKeyDown={blockInvalidChar}
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
