'use client';

import Link from 'next/link';
import { Product, Variant } from '@/types/product';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<Variant>(product.variants[0]);
  const [userSelectedImage, setUserSelectedImage] = useState<string | null>(null);

  if (!product.variants || product.variants.length === 0) return null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedVariant.stock <= 0) {
      toast.error(t('product_out_of_stock'));
      return;
    }
    addToCart(product, selectedVariant, 1);
  };

  const discount = product.comparePrice && product.comparePrice > product.basePrice
    ? Math.round(((product.comparePrice - product.basePrice) / product.comparePrice) * 100)
    : 0;

  const allMainImages = product.images?.map(i => i.url) || [];
  const allVariantImages = product.variants?.map(v => v.imageUrl).filter(Boolean) || [];
  const orderedImages = [...allMainImages, ...allVariantImages];
  const displayImage = userSelectedImage || orderedImages[0] || '/placeholder.png';
  const hoverImage = orderedImages.find(img => img !== displayImage) || displayImage;

  return (
    <div className="group relative flex flex-col gap-3">
      <Link href={`/catalog/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface rounded-sm">
          {discount > 0 && (
            <span className="absolute top-3 left-3 z-10 bg-accent text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide">
              -{discount}%
            </span>
          )}

          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:opacity-0"
          />

          <Image
            src={hoverImage}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-all duration-700 scale-105 opacity-0 group-hover:opacity-100 group-hover:scale-100"
          />

          <button
            onClick={handleAddToCart}
            className="absolute bottom-4 right-4 bg-surface text-primary p-3 rounded-full shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-primary hover:text-base-color"
            title={t('product_add_to_cart')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

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

      {product.variants.length > 1 && (
        <div className="flex gap-1">
          {product.variants.map((variant) => (
            <button
              key={variant.sku}
              onClick={(e) => {
                e.preventDefault();
                setSelectedVariant(variant);
                if (variant.imageUrl) setUserSelectedImage(variant.imageUrl);
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
