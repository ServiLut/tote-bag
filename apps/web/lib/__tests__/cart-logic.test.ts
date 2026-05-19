import { 
  calculateCartSubtotal, 
  calculateCartCount, 
  addItemToCart, 
  migrateCartData,
  CartItem
} from '../cart-logic';

describe('Cart Pure Logic', () => {
  const mockItem: CartItem = {
    id: 'sku1',
    product: { id: 'p1', name: 'Product 1', basePrice: 100 },
    variant: { id: 'v1', sku: 'sku1', salePrice: 90 },
    quantity: 2,
    unitPrice: 90
  };

  it('calculates subtotal correctly', () => {
    const items: CartItem[] = [mockItem, { ...mockItem, id: 'sku2', unitPrice: 50, quantity: 1 }];
    // (90 * 2) + (50 * 1) = 230
    expect(calculateCartSubtotal(items)).toBe(230);
  });

  it('calculates count correctly', () => {
    const items: CartItem[] = [mockItem, { ...mockItem, id: 'sku2', quantity: 5 }];
    expect(calculateCartCount(items)).toBe(7);
  });

  it('adds item to cart (new item)', () => {
    const items: CartItem[] = [];
    const result = addItemToCart(items, mockItem);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it('merges item into cart (existing item)', () => {
    const items: CartItem[] = [mockItem];
    const result = addItemToCart(items, { ...mockItem, quantity: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('migrates legacy array format to versioned object', () => {
    const legacyData = [mockItem];
    const migrated = migrateCartData(legacyData);
    expect(migrated.version).toBe(1);
    expect(migrated.items).toHaveLength(1);
    expect(migrated.updatedAt).toBeDefined();
  });
});
