'use client';

import Link from 'next/link';
import { Product, Variant } from '@/types/product';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<Variant>(product.variants[0]);

  // Fallback if no variants
  if (!product.variants || product.variants.length === 0) return null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedVariant.stock <= 0) {
      toast.error('Producto agotado');
      return;
    }
    addToCart(product, selectedVariant, 1);
  };

  const discount = product.comparePrice && product.comparePrice > product.basePrice
    ? Math.round(((product.comparePrice - product.basePrice) / product.comparePrice) * 100)
    : 0;

  return (
    <div 
      className="group relative flex flex-col gap-3"
    >
      <Link href={`/catalog/${product.slug}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface rounded-sm">
          {discount > 0 && (
            <span className="absolute top-3 left-3 z-10 bg-accent text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide">
              -{discount}%
            </span>
          )}
          
          {/* Main Image */}
          <Image
            src={selectedVariant.imageUrl || product.images[0]?.url || '/placeholder.svg'}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Quick Add Button (Desktop) */}
          <button
            onClick={handleAddToCart}
            className="absolute bottom-4 right-4 bg-surface text-primary p-3 rounded-full shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-primary hover:text-base-color"
            title="Agregar al carrito"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="space-y-1 mt-3">
          <h3 className="font-medium text-primary text-lg leading-tight group-hover:underline decoration-1 underline-offset-4">
            {product.name}
          </h3>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-primary">
              ${product.basePrice.toLocaleString('es-CO')}
            </span>
            {product.comparePrice && (
              <span className="text-muted line-through text-xs">
                ${product.comparePrice.toLocaleString('es-CO')}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Color Swatches */}
      {product.variants.length > 1 && (
        <div className="flex gap-1">
          {product.variants.map((variant) => (
            <button
              key={variant.sku}
              onClick={(e) => {
                e.preventDefault();
                setSelectedVariant(variant);
              }}
              className={`w-4 h-4 rounded-full border border-theme ring-1 ring-offset-1 transition-all ${
                selectedVariant.sku === variant.sku 
                  ? 'ring-primary scale-110' 
                  : 'ring-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: getVariantColorHex(variant.color) }}
              title={variant.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper simple para mapear nombres de colores a hex (esto debería venir del backend idealmente o ser imágenes)
function getVariantColorHex(colorName: string): string {
  const map: Record<string, string> = {
    'negro': '#000000',
    'blanco': '#FFFFFF',
    'crudo': '#F5F5DC',
    'beige': '#F5F5DC',
    'azul': '#0000FF',
    'verde': '#008000',
    'rojo': '#FF0000',
  };
  return map[colorName.toLowerCase()] || '#cccccc';
}
