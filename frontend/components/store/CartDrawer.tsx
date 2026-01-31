'use client';

import { useCart } from '@/context/CartContext';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeFromCart, subtotal } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        closeCart();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Disable scroll
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={drawerRef}
        className="w-full max-w-md h-full bg-base shadow-xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme">
          <h2 className="text-xl font-semibold flex items-center gap-2 font-serif text-primary">
            <ShoppingBag className="w-5 h-5" />
            Tu Carrito ({items.length})
          </h2>
          <button 
            onClick={closeCart}
            className="p-2 hover:bg-primary/5 rounded-full transition-colors text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted">
              <ShoppingBag className="w-16 h-16 opacity-20" />
              <p>Tu carrito está vacío.</p>
              <button 
                onClick={closeCart}
                className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-70 transition-opacity"
              >
                Continuar comprando
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="relative w-20 h-24 bg-surface rounded-md overflow-hidden flex-shrink-0 border border-theme">
                  <Image
                    src={item.variant.imageUrl || item.product.images[0]?.url || '/placeholder.svg'}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-sm leading-tight pr-4 text-primary">{item.product.name}</h3>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted hover:text-accent transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted mt-1">Color: {item.variant.color}</p>
                    <p className="text-sm font-semibold mt-1 text-primary">
                      ${item.product.basePrice.toLocaleString('es-CO')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-theme rounded-full">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1.5 hover:bg-primary/5 rounded-l-full transition-colors disabled:opacity-50 text-primary"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-medium w-6 text-center text-primary">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1.5 hover:bg-primary/5 rounded-r-full transition-colors text-primary"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-theme bg-primary/5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-primary">${subtotal.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Envío</span>
                <span className="text-muted/60 text-xs italic">Calculado en el checkout</span>
              </div>
            </div>
            
            <Link 
              href="/checkout"
              onClick={closeCart}
              className="w-full py-4 btn-primary flex items-center justify-center gap-2 rounded-sm uppercase tracking-wide text-sm font-bold"
            >
              Proceder al Pago
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
