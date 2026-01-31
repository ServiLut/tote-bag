'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Variant } from '@/types/product';
import { toast } from 'sonner';

export interface CartItem {
  id: string; // unique ID for cart item (e.g. sku)
  product: Product;
  variant: Variant;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, variant: Variant, quantity?: number) => void;
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

  // Load cart from local storage on mount
  useEffect(() => {
    // eslint-disable-next-line
    setIsMounted(true);
    const savedCart = localStorage.getItem('tote-cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
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

  const addToCart = (product: Product, variant: Variant, quantity = 1) => {
    setItems((currentItems) => {
      const existingItemIndex = currentItems.findIndex(
        (item) => item.variant.sku === variant.sku
      );

      if (existingItemIndex > -1) {
        const newItems = [...currentItems];
        newItems[existingItemIndex].quantity += quantity;
        toast.success(`Cantidad actualizada: ${product.name} (${variant.color})`);
        return newItems;
      }

      toast.success(`Agregado al carrito: ${product.name}`);
      return [...currentItems, { id: variant.sku, product, variant, quantity }];
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

  const subtotal = items.reduce((total, item) => total + item.product.basePrice * item.quantity, 0);
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
