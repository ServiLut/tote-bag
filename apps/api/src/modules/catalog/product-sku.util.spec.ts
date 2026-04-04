import {
  buildProductSku,
  normalizeSkuSegment,
  normalizeSkuValue,
} from './product-sku.util';

describe('catalog product sku utils', () => {
  it('genera el mismo SKU canonico para nombres con acentos y signos', () => {
    expect(normalizeSkuSegment(' Línea Niño / edición ')).toBe(
      'LINEANINOEDICION',
    );
    expect(buildProductSku('Línea Niño', 'Diseño Único', 'Azúl #1')).toBe(
      'TB-LINEANINO-DISENOUNICO-AZUL1',
    );
  });

  it('normaliza un SKU digitado manualmente', () => {
    expect(normalizeSkuValue(' tb-línea niño-diseño único-azúl #1 ')).toBe(
      'TB-LINEANINO-DISENOUNICO-AZUL1',
    );
  });
});
