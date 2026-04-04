import {
  buildProductSku,
  normalizeSkuSegment,
  normalizeSkuValue,
} from '../product-sku';

describe('product SKU helpers', () => {
  it('normaliza acentos, espacios y simbolos de forma consistente', () => {
    expect(normalizeSkuSegment(' Línea Niño / edición ')).toBe('LINEANINOEDICION');
    expect(buildProductSku('Línea Niño', 'Diseño Único', 'Azúl #1')).toBe(
      'TB-LINEANINO-DISENOUNICO-AZUL1',
    );
  });

  it('normaliza SKUs manuales manteniendo la estructura por segmentos', () => {
    expect(normalizeSkuValue(' tb-línea niño-diseño único-azúl #1 ')).toBe(
      'TB-LINEANINO-DISENOUNICO-AZUL1',
    );
  });
});
