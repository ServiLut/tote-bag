export const DEFAULT_CATALOG_MAX_PRICE = 1_000_000;

export type CatalogFilterKey =
  | 'collection'
  | 'lines'
  | 'sizes'
  | 'materials'
  | 'minPrice'
  | 'maxPrice';

export interface CatalogFilterStateSnapshot {
  minPrice: number;
  maxPrice: number;
  collections: string[];
  lines: string[];
  sizes: string[];
  qualities: string[];
  materials: string[];
  status: string[];
}

type SearchParamSource =
  | URLSearchParams
  | { toString(): string }
  | string
  | null
  | undefined;

const FILTER_QUERY_KEYS: CatalogFilterKey[] = [
  'collection',
  'lines',
  'sizes',
  'materials',
  'minPrice',
  'maxPrice',
];

function cloneSearchParams(searchParams?: SearchParamSource) {
  if (!searchParams) {
    return new URLSearchParams();
  }

  if (typeof searchParams === 'string') {
    return new URLSearchParams(searchParams);
  }

  return new URLSearchParams(searchParams.toString());
}

export function buildCatalogSearchParams(
  filters: CatalogFilterStateSnapshot,
  currentSearchParams?: SearchParamSource,
) {
  const params = cloneSearchParams(currentSearchParams);

  for (const key of FILTER_QUERY_KEYS) {
    params.delete(key);
  }

  if (filters.collections.length > 0) {
    params.set('collection', filters.collections.join(','));
  }
  if (filters.lines.length > 0) {
    params.set('lines', filters.lines.join(','));
  }
  if (filters.sizes.length > 0) {
    params.set('sizes', filters.sizes.join(','));
  }
  if (filters.materials.length > 0) {
    params.set('materials', filters.materials.join(','));
  }
  if (filters.minPrice > 0) {
    params.set('minPrice', filters.minPrice.toString());
  }
  if (filters.maxPrice > 0 && filters.maxPrice < DEFAULT_CATALOG_MAX_PRICE) {
    params.set('maxPrice', filters.maxPrice.toString());
  }

  return params;
}

export function parseCatalogPriceFilterValue(
  field: 'minPrice' | 'maxPrice',
  value: string,
) {
  if (!value) {
    return field === 'maxPrice' ? DEFAULT_CATALOG_MAX_PRICE : 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return field === 'maxPrice' ? DEFAULT_CATALOG_MAX_PRICE : 0;
  }

  if (field === 'maxPrice' && parsed === 0) {
    return DEFAULT_CATALOG_MAX_PRICE;
  }

  return parsed;
}

export function readCatalogFiltersFromSearchParams(
  searchParams: SearchParamSource,
  currentFilters: CatalogFilterStateSnapshot,
) {
  const params = cloneSearchParams(searchParams);
  const nextFilters: CatalogFilterStateSnapshot = {
    ...currentFilters,
    collections: [],
    lines: [],
    sizes: [],
    qualities: currentFilters.qualities,
    materials: [],
    status: currentFilters.status,
    minPrice: 0,
    maxPrice: DEFAULT_CATALOG_MAX_PRICE,
  };

  const collection = params.get('collection');
  if (collection) {
    nextFilters.collections = collection.split(',').filter(Boolean);
  }

  const lines = params.get('lines');
  if (lines) {
    nextFilters.lines = lines.split(',').filter(Boolean);
  }

  const sizes = params.get('sizes');
  if (sizes) {
    nextFilters.sizes = sizes.split(',').filter(Boolean);
  }

  const materials = params.get('materials');
  if (materials) {
    nextFilters.materials = materials.split(',').filter(Boolean);
  }

  nextFilters.minPrice = parseCatalogPriceFilterValue(
    'minPrice',
    params.get('minPrice') ?? '',
  );
  nextFilters.maxPrice = parseCatalogPriceFilterValue(
    'maxPrice',
    params.get('maxPrice') ?? '',
  );

  return nextFilters;
}
