'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Product, Variant } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { Minus, Plus, ShoppingBag, Truck, ShieldCheck, Ruler } from 'lucide-react';
import { toast } from 'sonner';

interface ProductDetailClientProps {
  product: Product;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const { addToCart } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants && product.variants.length > 0 ? product.variants[0] : ({} as Variant)
  );
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Combine variant image (if exists) with product images
  const allImages = [
    ...(selectedVariant?.imageUrl ? [{ url: selectedVariant.imageUrl, id: 'variant-img' }] : []),
    ...(product.images || [])
  ];

  const currentImageUrl = allImages[currentImageIndex]?.url || '/placeholder.svg';

  const handleAddToCart = () => {
    if (!selectedVariant.sku) { // Basic check
       return;
    }
    if (selectedVariant.stock < quantity) {
      toast.error('Cantidad supera el stock disponible');
      return;
    }
    addToCart(product, selectedVariant, quantity);
    toast.success('Producto agregado al carrito');
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const discount = product.comparePrice && product.comparePrice > product.basePrice
    ? Math.round(((product.comparePrice - product.basePrice) / product.comparePrice) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
      {/* Left: Image Gallery */}
      <div className="space-y-4">
        <div className="relative aspect-[3/4] bg-surface rounded-sm overflow-hidden">
           {discount > 0 && (
            <span className="absolute top-4 left-4 z-10 bg-accent text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
              -{discount}% OFF
            </span>
          )}
          <Image
            src={currentImageUrl}
            alt={product.name}
            fill
            className="object-cover"
            priority
          />
        </div>
        
        {/* Thumbnails */}
        {allImages.length > 1 && (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`relative w-20 h-20 shrink-0 border-2 transition-all ${
                  currentImageIndex === idx ? 'border-primary opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={img.url}
                  alt={`Thumbnail ${idx}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Product Info */}
      <div className="flex flex-col h-full">
        <div className="mb-2">
           {product.collection && (
             <span className="text-xs font-bold uppercase tracking-widest text-secondary mb-2 block">
               {product.collection.name}
             </span>
           )}
           <h1 className="text-3xl md:text-4xl font-serif text-primary leading-tight">
             {product.name}
           </h1>
        </div>

        <div className="flex items-end gap-3 mb-6 border-b border-theme pb-6">
          <span className="text-2xl font-bold text-primary">
            ${product.basePrice.toLocaleString('es-CO')}
          </span>
          {product.comparePrice && (
            <span className="text-lg text-muted line-through mb-1">
              ${product.comparePrice.toLocaleString('es-CO')}
            </span>
          )}
        </div>

        <div className="space-y-6 mb-8">
          <p className="text-muted leading-relaxed">
            {product.description}
          </p>

          {/* Variants / Colors */}
          {product.variants.length > 0 && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-primary block mb-3">
                Color: <span className="text-muted font-normal capitalize">{selectedVariant.color}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.sku}
                    onClick={() => {
                        setSelectedVariant(variant);
                        // Optional: Reset image to variant image when clicked
                        const variantImgIdx = allImages.findIndex(img => img.url === variant.imageUrl);
                        if (variantImgIdx !== -1) setCurrentImageIndex(variantImgIdx);
                    }}
                    className={`w-8 h-8 rounded-full border border-theme ring-1 ring-offset-0 transition-all ${
                      selectedVariant.sku === variant.sku 
                        ? 'ring-primary scale-110' 
                        : 'ring-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: getVariantColorHex(variant.color) }}
                    title={variant.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <div className="flex items-center border border-theme rounded-lg w-fit">
              <button 
                onClick={() => handleQuantityChange(-1)}
                className="p-3 hover:bg-primary/5 transition-colors disabled:opacity-50"
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button 
                 onClick={() => handleQuantityChange(1)}
                 className="p-3 hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={selectedVariant.stock === 0}
              className="flex-1 bg-primary text-base-color font-bold uppercase tracking-widest py-4 px-8 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300"
            >
              <ShoppingBag className="w-5 h-5" />
              {selectedVariant.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
            </button>
          </div>
        </div>

        {/* Features / Extra Info */}
        <div className="grid grid-cols-1 gap-4 py-6 border-t border-theme text-sm text-muted">
           <div className="flex items-start gap-3">
             <Truck className="w-5 h-5 text-secondary shrink-0" />
             <div>
               <span className="font-bold text-primary block mb-0.5">Envío Nacional Seguro</span>
               <p>Entregas en 3-5 días hábiles a ciudades principales.</p>
             </div>
           </div>
           <div className="flex items-start gap-3">
             <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
             <div>
               <span className="font-bold text-primary block mb-0.5">Garantía de Calidad</span>
               <p>Materiales premium y costuras reforzadas.</p>
             </div>
           </div>
           <div className="flex items-start gap-3">
             <Ruler className="w-5 h-5 text-secondary shrink-0" />
             <div>
               <span className="font-bold text-primary block mb-0.5">Dimensiones</span>
               <p>Ideales para el día a día. Consulta la guía de tallas.</p>
             </div>
           </div>
        </div>
      </div>
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
    'rosa': '#FFC0CB',
    'amarillo': '#FFFF00',
  };
  return map[colorName.toLowerCase()] || '#cccccc';
}
