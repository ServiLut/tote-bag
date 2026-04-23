import {
  getManualOrderContactPhone,
  getManualOrderUnitPrice,
} from '../manual-order';

describe('manual order helpers', () => {
  it('cobra el mayor entre salePrice y minPrice', () => {
    expect(
      getManualOrderUnitPrice({
        salePrice: 30000,
        minPrice: 45000,
      }),
    ).toBe(45000);
  });

  it('usa salePrice cuando ya cumple el minimo', () => {
    expect(
      getManualOrderUnitPrice({
        salePrice: 52000,
        minPrice: 45000,
      }),
    ).toBe(52000);
  });

  it('prioriza el telefono editado en la orden', () => {
    expect(
      getManualOrderContactPhone(' 3001234567 ', '3110000000'),
    ).toBe('3001234567');
  });

  it('cae al telefono del perfil si el de envio esta vacio', () => {
    expect(getManualOrderContactPhone('   ', '3110000000')).toBe('3110000000');
  });
});
