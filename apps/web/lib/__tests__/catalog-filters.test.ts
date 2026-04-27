import {
  buildCatalogSearchParams,
  DEFAULT_CATALOG_MAX_PRICE,
  parseCatalogPriceFilterValue,
  readCatalogFiltersFromSearchParams,
} from '../catalog-filters';

describe('catalog filters', () => {
  it('preserva search y reemplaza solo los parametros de filtro del catalogo', () => {
    const params = buildCatalogSearchParams(
      {
        minPrice: 15000,
        maxPrice: DEFAULT_CATALOG_MAX_PRICE,
        collections: ['collection-a'],
        lines: ['premium'],
        sizes: [],
        qualities: [],
        materials: ['algodon'],
        status: [],
      },
      'search=negra&page=2&maxPrice=999999',
    );

    expect(params.toString()).toBe(
      'search=negra&page=2&collection=collection-a&lines=premium&materials=algodon&minPrice=15000',
    );
  });

  it('trata maxPrice vacio como un filtro sin tope', () => {
    expect(parseCatalogPriceFilterValue('maxPrice', '')).toBe(
      DEFAULT_CATALOG_MAX_PRICE,
    );
    expect(parseCatalogPriceFilterValue('maxPrice', '0')).toBe(
      DEFAULT_CATALOG_MAX_PRICE,
    );
    expect(parseCatalogPriceFilterValue('minPrice', '')).toBe(0);
  });

  it('hidrata el estado desde la URL con defaults seguros', () => {
    const filters = readCatalogFiltersFromSearchParams(
      'search=negra&collection=collection-a,collection-b&minPrice=5000',
      {
        minPrice: 1,
        maxPrice: 2,
        collections: ['legacy'],
        lines: ['legacy'],
        sizes: ['legacy'],
        qualities: ['legacy'],
        materials: ['legacy'],
        status: ['legacy'],
      },
    );

    expect(filters).toEqual({
      minPrice: 5000,
      maxPrice: DEFAULT_CATALOG_MAX_PRICE,
      collections: ['collection-a', 'collection-b'],
      lines: [],
      sizes: [],
      qualities: ['legacy'],
      materials: [],
      status: ['legacy'],
    });
  });
});
