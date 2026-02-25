'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Variant } from '@/types/product';
import { toast } from 'sonner';

export interface CartItem {
  id: string; // unique ID for cart item (sku + configCode if applicable)
  product: Product;
  variant: Variant;
  quantity: number;
  configuration?: Record<string, unknown>;
  unitPrice: number;
  configCode?: string;
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

  // Set mounted flag after first render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Load cart from local storage ONLY ONCE on mount, but after we know we are on client
  useEffect(() => {
    const savedCart = localStorage.getItem('tote-cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
           // eslint-disable-next-line react-hooks/set-state-in-effect
           setItems(parsed);
        }
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('tote-cart', JSON.stringify(items));
    }
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
    setItems((currentItems) => {
      const itemId = configCode ? `${variant.sku}-${configCode}` : variant.sku;
      const existingItemIndex = currentItems.findIndex(
        (item) => item.id === itemId
      );

      const price = unitPrice !== undefined ? unitPrice : product.basePrice;

      if (existingItemIndex > -1) {
        const newItems = [...currentItems];
        newItems[existingItemIndex].quantity += quantity;
        toast.success(`Cantidad actualizada: ${product.name}`);
        return newItems;
      }

      toast.success(`Agregado al carrito: ${product.name}`);
      return [...currentItems, { 
        id: itemId, 
        product, 
        variant, 
        quantity, 
        configuration, 
        unitPrice: price,
        configCode
      }];
    });
    setIsOpen(true);
  };

  const removeFromCart = (cartItemId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const count = items.reduce((total, item) => total + item.quantity, 0);

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
