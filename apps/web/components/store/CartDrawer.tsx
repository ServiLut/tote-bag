'use client';

import { useCart, type CartItem } from '@/context/CartContext';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const CUSTOM_TOTE_FALLBACK_IMAGE = '/tote_bag_lifestyle.png';

function getCartItemImage(item: CartItem) {
  if (item.isCustom) {
    return item.customImageURL || CUSTOM_TOTE_FALLBACK_IMAGE;
  }

  return item.product.images[0]?.url || item.variant.imageUrl || CUSTOM_TOTE_FALLBACK_IMAGE;
}

function CartDrawerItemImage({ item }: { item: CartItem }) {
  const [src, setSrc] = useState(() => getCartItemImage(item));

  useEffect(() => {
    setSrc(getCartItemImage(item));
  }, [item]);

  return (
    <Image
      src={src}
      alt={item.product.name}
      fill
      className="object-cover"
      onError={() => {
        if (src !== CUSTOM_TOTE_FALLBACK_IMAGE) {
          setSrc(CUSTOM_TOTE_FALLBACK_IMAGE);
        }
      }}
    />
  );
}

export default function CartDrawer() {
  const { t } = useTranslation();
  const { items, isOpen, closeCart, updateQuantity, removeFromCart, subtotal } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        closeCart();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
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
        <div className="flex items-center justify-between p-6 border-b border-theme">
          <h2 className="text-xl font-semibold flex items-center gap-2 font-serif text-primary">
            <ShoppingBag className="w-5 h-5" />
            {t('cart_title', { count: items.length })}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-primary/5 rounded-full transition-colors text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted">
              <ShoppingBag className="w-16 h-16 opacity-20" />
              <p>{t('cart_empty')}</p>
              <button
                onClick={closeCart}
                className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-70 transition-opacity"
              >
                {t('cart_continue_shopping')}
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="relative w-20 h-24 bg-surface rounded-md overflow-hidden flex-shrink-0 border border-theme">
                  <CartDrawerItemImage item={item} />
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
                    <p className="text-xs text-muted mt-1">{t('cart_color', { color: item.variant.color })}</p>
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

        {items.length > 0 && (
          <div className="p-6 border-t border-theme bg-primary/5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('cart_subtotal')}</span>
                <span className="font-semibold text-primary">${subtotal.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('cart_shipping')}</span>
                <span className="text-muted/60 text-xs italic">{t('cart_shipping_checkout')}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="w-full py-4 btn-primary flex items-center justify-center gap-2 rounded-sm uppercase tracking-wide text-sm font-bold"
            >
              {t('cart_checkout')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
