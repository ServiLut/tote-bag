'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { CATALOG_ATTRIBUTES } from '@/utils/catalog-constants';
import { cn } from '@/utils/cn';
import { apiFetch } from '@/utils/api';
import { formatCurrencyInput, parseLocalizedNumber, sanitizeDecimalInput } from '@/lib/numeric-input';
import { useTranslation } from 'react-i18next';

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
  isOpen?: boolean;
  onClose?: () => void;
}

export default function FilterSidebar({ collections, filters, onFilterChange, isOpen, onClose }: FilterSidebarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialWizardOptions = {
    LINE: (CATALOG_ATTRIBUTES?.LINE || []).map(name => ({ id: name, name, code: name })),
    DIMENSION: (CATALOG_ATTRIBUTES?.SIZE || []).map(name => ({ id: name, name, code: name })),
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
    if (newFilters.materials.length > 0) params.set('materials', newFilters.materials.join(','));
    if (newFilters.status.length > 0) params.set('status', newFilters.status.join(','));
    if (newFilters.minPrice > 0) params.set('minPrice', newFilters.minPrice.toString());
    if (newFilters.maxPrice < 1000000) params.set('maxPrice', newFilters.maxPrice.toString());

    const query = params.toString();
    router.push(`${window.location.pathname}${query ? '?' + query : ''}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const newFilters = { ...filters };
    let hasChanges = false;

    const sync = (key: string, field: Extract<keyof FilterState, 'collections' | 'lines' | 'sizes' | 'materials' | 'status'>) => {
      const val = searchParams.get(key);
      if (val) {
        (newFilters[field] as string[]) = val.split(',');
        hasChanges = true;
      }
    };

    sync('collection', 'collections');
    sync('lines', 'lines');
    sync('sizes', 'sizes');
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchWizardOptions = async () => {
      try {
        const res = await apiFetch('/wizard-options/grouped');
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          setWizardOptions(data);
        }
      } catch (err) {
        console.error('Error fetching wizard options:', err);
      }
    };
    fetchWizardOptions();
  }, []);

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
    const sanitizedValue = sanitizeDecimalInput(value);
    onFilterChange({
      ...filters,
      [name]: sanitizedValue ? parseLocalizedNumber(sanitizedValue) : 0,
    });
  };

  const renderCheckboxGroup = (title: string, field: keyof FilterState, options: string[], section: keyof typeof openSections) => (
    <div className="border-b border-theme pb-6">
      <button onClick={() => toggleSection(section)} className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary">
        {title}
        {openSections[section] ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
      </button>

      {openSections[section] && (
        <div className="space-y-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 border flex items-center justify-center transition-all rounded-sm ${
                (filters[field] as string[]).includes(opt) ? 'bg-primary border-primary' : 'border-theme group-hover:border-primary'
              }`}>
                {(filters[field] as string[]).includes(opt) && <div className="w-1.5 h-1.5 bg-base-color" />}
              </div>
              <input type="checkbox" className="hidden" checked={(filters[field] as string[]).includes(opt)} onChange={() => handleCheckboxChange(field, opt)} />
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[100] lg:hidden backdrop-blur-sm" onClick={onClose} />}

      <aside className={cn(
        'bg-base flex-shrink-0 space-y-8 transition-all duration-300 ease-in-out',
        'lg:w-64 lg:static lg:block lg:pr-8 lg:border-r lg:border-theme lg:translate-x-0 lg:z-0 lg:overflow-visible',
        'fixed top-0 left-0 bottom-0 z-[101] w-80 p-6 overflow-y-auto border-r border-theme shadow-2xl lg:shadow-none',
        !isOpen && '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
            {t('filters_title')}
          </h3>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-theme/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-primary" />
            </button>
          )}
        </div>

        {renderCheckboxGroup(t('filters_lines'), 'lines', (wizardOptions.LINE || []).map(l => l.name), 'line')}

        <div className="border-b border-theme pb-6">
          <button onClick={() => toggleSection('collection')} className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary">
            {t('filters_collections')}
            {openSections.collection ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
          </button>
          {openSections.collection && (
            <div className="space-y-3">
              {collections.map((coll) => (
                <label key={coll.id} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 border flex items-center justify-center transition-all rounded-sm ${
                    filters.collections.includes(coll.id) ? 'bg-primary border-primary' : 'border-theme group-hover:border-primary'
                  }`}>
                    {filters.collections.includes(coll.id) && <div className="w-1.5 h-1.5 bg-base-color" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={filters.collections.includes(coll.id)} onChange={() => handleCheckboxChange('collections', coll.id)} />
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{coll.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-theme pb-6">
          <button onClick={() => toggleSection('attributes')} className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary">
            {t('filters_features')}
            {openSections.attributes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
          </button>
          {openSections.attributes && (
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">{t('filters_size')}</p>
                <div className="space-y-2">
                  {(wizardOptions.DIMENSION || []).length > 0 ? (wizardOptions.DIMENSION || []).map(dim => (
                    <label key={dim.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-primary border-theme" checked={filters.sizes.includes(dim.name)} onChange={() => handleCheckboxChange('sizes', dim.name)} />
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{dim.name}</span>
                    </label>
                  )) : <p className="text-[10px] text-muted italic">{t('filters_no_options')}</p>}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted mb-3 tracking-widest opacity-60">{t('filters_material')}</p>
                <div className="space-y-2">
                  {(wizardOptions.MATERIAL || []).length > 0 ? (wizardOptions.MATERIAL || []).map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-primary border-theme" checked={filters.materials.includes(m.name)} onChange={() => handleCheckboxChange('materials', m.name)} />
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">{m.name}</span>
                    </label>
                  )) : <p className="text-[10px] text-muted italic">{t('filters_no_options')}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-theme pb-6">
          <button onClick={() => toggleSection('price')} className="flex justify-between items-center w-full text-xs font-black uppercase tracking-[0.2em] mb-4 text-primary">
            {t('filters_price_range')}
            {openSections.price ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
          </button>
          {openSections.price && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="space-y-1.5 flex-1">
                  <label className="text-[9px] font-black uppercase text-muted tracking-widest opacity-60">{t('filters_min')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-[10px] font-bold text-muted">$</span>
                    <input type="text" name="minPrice" inputMode="numeric" value={filters.minPrice === 0 ? '' : formatCurrencyInput(String(filters.minPrice))} onChange={handlePriceChange} className="w-full pl-6 py-2 border border-theme bg-base text-primary text-xs font-bold focus:border-primary outline-none transition-all rounded-lg" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-[9px] font-black uppercase text-muted tracking-widest opacity-60">{t('filters_max')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-[10px] font-bold text-muted">$</span>
                    <input type="text" name="maxPrice" inputMode="numeric" value={filters.maxPrice === 0 ? '' : formatCurrencyInput(String(filters.maxPrice))} onChange={handlePriceChange} className="w-full pl-6 py-2 border border-theme bg-base text-primary text-xs font-bold focus:border-primary outline-none transition-all rounded-lg" placeholder="999..." />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {renderCheckboxGroup(t('filters_availability'), 'status', ['DISPONIBLE', 'BAJO_PEDIDO'], 'availability')}
      </aside>
    </>
  );
}
