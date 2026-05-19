'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Product, Variant } from '@/types/product';
import { toast } from 'sonner';
import { 
  migrateCartData, 
  addItemToCart, 
  calculateCartSubtotal, 
  calculateCartCount,
  CART_SCHEMA_VERSION,
  CartItem
} from '@/lib/cart-logic';

export { type CartItem } from '@/lib/cart-logic';

const CART_STORAGE_KEY = 'tote-cart-v1';
const PERSIST_DEBOUNCE_MS = 1000;

function getConfigurationImage(
  configuration?: Record<string, unknown>,
): string | undefined {
  if (typeof configuration?.customImageURL === 'string') {
    return configuration.customImageURL;
  }

  if (typeof configuration?.previewUrl === 'string') {
    return configuration.previewUrl;
  }

  if (
    configuration?.customizationSettings
    && typeof configuration.customizationSettings === 'object'
    && typeof (configuration.customizationSettings as Record<string, unknown>).customImageURL === 'string'
  ) {
    return (configuration.customizationSettings as Record<string, unknown>).customImageURL as string;
  }

  return undefined;
}

function normalizeCartItem(item: CartItem): CartItem {
  const configurationImage = getConfigurationImage(item.configuration);
  const isCustom = Boolean(item.configCode || configurationImage);

  return {
    ...item,
    isCustom,
    customImageURL: configurationImage,
  };
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, variant: Variant, quantity?: number, configuration?: Record<string, unknown>, unitPrice?: number, configCode?: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set mounted flag after first render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Load cart from local storage with migration
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY) || localStorage.getItem('tote-cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        const migrated = migrateCartData(parsed);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(migrated.items.map(normalizeCartItem));
      } catch (e) {
        console.error('[Cart] Failed to load/migrate cart:', e);
      }
    }
  }, []);

  // Debounced persistence
  useEffect(() => {
    if (!isMounted) return;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      const state = {
        items,
        version: CART_SCHEMA_VERSION,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [items, isMounted]);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addToCart = (
    product: Product, 
    variant: Variant, 
    quantity = 1, 
    configuration?: Record<string, unknown>, 
    unitPrice?: number, 
    configCode?: string
  ) => {
    const itemId = configCode ? `${variant.sku}-${configCode}` : variant.sku;
    const configurationImage = getConfigurationImage(configuration);
    const customImageURL = configurationImage;
    const isCustom = Boolean(configCode || customImageURL);

    const price =
      unitPrice !== undefined
        ? unitPrice
        : variant.salePrice !== undefined
          ? variant.salePrice
          : product.basePrice;

    const newItem: CartItem = { 
      id: itemId, 
      product: { 
        id: product.id, 
        name: product.name, 
        basePrice: product.basePrice,
        images: product.images?.map(img => ({ url: img.url, position: img.position }))
      }, 
      variant: { 
        id: variant.id ?? '', 
        sku: variant.sku, 
        salePrice: variant.salePrice,
        imageUrl: variant.imageUrl
      }, 
      quantity, 
      configuration, 
      unitPrice: price,
      configCode,
      isCustom,
      customImageURL,
    };

    setItems((current) => {
      const updated = addItemToCart(current, newItem);
      const isNew = updated.length > current.length;
      toast.success(isNew ? `Agregado al carrito: ${product.name}` : `Cantidad actualizada: ${product.name}`);
      return updated;
    });

    setIsOpen(true);
  };

  const removeFromCart = (cartItemId: string) => {
    setItems((current) => current.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((current) =>
      current.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = calculateCartSubtotal(items);
  const count = calculateCartCount(items);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
