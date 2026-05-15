import {
  isTerminalConfirmationState,
  rememberPendingCheckoutOrder,
  resolveConfirmationStateFromPublicStatus,
  shouldClearCartForApprovedOrder,
} from '../checkout-confirmation';

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe('checkout confirmation helpers', () => {
  it('solo limpia el carrito cuando la orden aprobada coincide con el checkout pendiente local', () => {
    const storage = createStorageMock();
    const cartItems = [
      { id: 'sku-a', quantity: 2 },
      { id: 'sku-b', quantity: 1 },
    ];

    rememberPendingCheckoutOrder('order-1', cartItems, storage);

    expect(
      shouldClearCartForApprovedOrder(
        'order-1',
        [
          { id: 'sku-b', quantity: 1 },
          { id: 'sku-a', quantity: 2 },
        ],
        storage,
      ),
    ).toBe(true);

    expect(
      shouldClearCartForApprovedOrder('order-1', cartItems, storage),
    ).toBe(false);
  });

  it('no limpia el carrito cuando el contenido actual ya cambio', () => {
    const storage = createStorageMock();

    rememberPendingCheckoutOrder(
      'order-2',
      [{ id: 'sku-a', quantity: 1 }],
      storage,
    );

    expect(
      shouldClearCartForApprovedOrder(
        'order-2',
        [{ id: 'sku-a', quantity: 2 }],
        storage,
      ),
    ).toBe(false);
  });

  it('resuelve el estado de confirmacion y marca como terminal los estados finales', () => {
    expect(
      resolveConfirmationStateFromPublicStatus({
        id: 'order-1',
        orderNumber: 1001,
        status: 'PAGADA',
        paymentConfirmed: true,
        awaitingPayment: false,
        paymentFailed: false,
      }),
    ).toBe('approved');

    expect(
      resolveConfirmationStateFromPublicStatus({
        id: 'order-2',
        orderNumber: 1002,
        status: 'PENDIENTE_PAGO',
        paymentConfirmed: false,
        awaitingPayment: true,
        paymentFailed: false,
      }),
    ).toBe('pending');

    expect(
      resolveConfirmationStateFromPublicStatus({
        id: 'order-3',
        orderNumber: 1003,
        status: 'RETURNED_TO_STOCK',
        paymentConfirmed: false,
        awaitingPayment: false,
        paymentFailed: false,
      }),
    ).toBe('idle');

    expect(isTerminalConfirmationState('approved')).toBe(true);
    expect(isTerminalConfirmationState('failed')).toBe(true);
    expect(isTerminalConfirmationState('error')).toBe(true);
    expect(isTerminalConfirmationState('idle')).toBe(true);
    expect(isTerminalConfirmationState('pending')).toBe(false);
    expect(isTerminalConfirmationState('loading')).toBe(false);
  });
});
