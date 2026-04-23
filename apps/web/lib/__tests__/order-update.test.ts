import { buildOrderStatusUpdatePayload } from '../order-update';

describe('order update payload', () => {
  it('omite tracking cuando no se esta actualizando la guia', () => {
    expect(buildOrderStatusUpdatePayload('PAGADA')).toEqual({
      status: 'PAGADA',
    });
  });

  it('preserva tracking existente en updates inline', () => {
    expect(buildOrderStatusUpdatePayload('ENVIADA', 'GUIA-123')).toEqual({
      status: 'ENVIADA',
      trackingNumber: 'GUIA-123',
    });
  });

  it('normaliza string vacio a null para limpiar la guia desde el modal', () => {
    expect(buildOrderStatusUpdatePayload('PAGADA', '   ')).toEqual({
      status: 'PAGADA',
      trackingNumber: null,
    });
  });
});
