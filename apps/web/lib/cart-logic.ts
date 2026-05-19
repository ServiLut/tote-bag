export interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    basePrice: number;
    images?: { url: string; position: number }[];
  };
  variant: {
    id: string;
    sku: string;
    size?: string;
    color?: string;
    salePrice?: number;
    imageUrl?: string;
  };
  quantity: number;
  configuration?: Record<string, unknown>;
  unitPrice: number;
  configCode?: string;
  isCustom?: boolean;
  customImageURL?: string;
}

export interface CartState {
  items: CartItem[];
  version: number;
  updatedAt: string;
}

export const CART_SCHEMA_VERSION = 1;

/**
 * Pure logic for calculating cart totals.
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + (item.unitPrice || 0) * item.quantity, 0);
}

/**
 * Pure logic for counting items in cart.
 */
export function calculateCartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Pure logic to check if two items are the same (for merging).
 */
export function isSameCartItem(a: CartItem, b: CartItem): boolean {
  if (a.variant.sku !== b.variant.sku) return false;
  if (a.configCode !== b.configCode) return false;
  // If we want more deep check on configuration, we could add it here
  return true;
}

/**
 * Logic to add an item to an existing list of items.
 */
export function addItemToCart(currentItems: CartItem[], newItem: CartItem): CartItem[] {
  const existingIndex = currentItems.findIndex(item => item.id === newItem.id);
  
  if (existingIndex > -1) {
    const updatedItems = [...currentItems];
    updatedItems[existingIndex] = {
      ...updatedItems[existingIndex],
      quantity: updatedItems[existingIndex].quantity + newItem.quantity
    };
    return updatedItems;
  }
  
  return [...currentItems, newItem];
}

/**
 * Migration logic for cart schema versions.
 */
export function migrateCartData(data: unknown): CartState {
  const defaultState: CartState = {
    items: [],
    version: CART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };

  if (!data) return defaultState;

  // If it's the old format (just an array)
  if (Array.isArray(data)) {
    return {
      items: data as CartItem[],
      version: CART_SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    };
  }

  const typedData = data as Partial<CartState>;

  // Handle versioned migrations here as they arise
  if (typedData.version === CART_SCHEMA_VERSION) {
    return typedData as CartState;
  }

  return defaultState;
}
