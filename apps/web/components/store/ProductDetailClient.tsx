'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Product, Variant } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { Minus, Plus, ShoppingBag, Truck, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProductDetailClientProps {
  product: Product;
}

interface Attribute {
  id: string;
  type: string;
  value: string;
  priceModifier: number;
  isActive: boolean;
  sortOrder: number;
}

interface PersonalizationOption {
  id: string;
  code: string;
  name: string;
  basePrice: number;
  allowedMaterialValues?: string[]; // Derived from rules
}

interface ApiPersonalizationOption extends PersonalizationOption {
  rule?: {
    allowedMaterialValues: string[];
  }
}

interface ProductConfig {
  attributes: Attribute[];
  personalizationOptions: PersonalizationOption[];
}

interface PricingSnapshot {
  configCode: string;
  minPriceGuardApplied: boolean;
  [key: string]: unknown;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const { addToCart } = useCart();
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants && product.variants.length > 0 ? product.variants[0] : ({} as Variant)
  );
  
  // Selection State
  const [selections, setSelections] = useState({
    size: product.attributes?.find(a => a.type === 'SIZE' && a.isActive)?.value || '',
    material: product.attributes?.find(a => a.type === 'MATERIAL' && a.isActive)?.value || '',
    quality: product.attributes?.find(a => a.type === 'QUALITY' && a.isActive)?.value || '',
    line: product.attributes?.find(a => a.type === 'LINE' && a.isActive)?.value || 'COMERCIAL',
    personalizations: [] as Array<{ code: string; options: string[] }>,
  });
  
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Pricing State
  const [calculatedPrice, setCalculatedPrice] = useState<number>(product.basePrice);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [configCode, setConfigCode] = useState<string | undefined>();
  const [pricingSnapshot, setPricingSnapshot] = useState<PricingSnapshot | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Fetch product config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/catalog/products/${product.slug}/config`);
        if (!res.ok) throw new Error('Failed to load config');
        const data = await res.json();
        
        // Transform personalization options to include material restriction data
        const transformedOptions = ((data.personalizationOptions as ApiPersonalizationOption[]) || []).map(opt => ({
          ...opt,
          allowedMaterialValues: opt.rule?.allowedMaterialValues || []
        }));

        setConfig({
          attributes: data.attributes || [],
          personalizationOptions: transformedOptions
        });
        
        // Initialize defaults from active attributes only if they are not already set
        const attrs = (data.attributes as Attribute[]) || [];
        const defaultSize = attrs.find((a) => a.type === 'SIZE')?.value;
        const defaultMaterial = attrs.find((a) => a.type === 'MATERIAL')?.value;
        const defaultQuality = attrs.find((a) => a.type === 'QUALITY')?.value;
        const defaultLine = attrs.find((a) => a.type === 'LINE')?.value;
        
        setSelections(prev => ({
          ...prev,
          size: defaultSize || prev.size,
          material: defaultMaterial || prev.material,
          quality: defaultQuality || prev.quality,
          line: defaultLine || prev.line || 'COMERCIAL',
        }));
      } catch (err) {
        console.error('Config fetch error:', err);
      }
    };
    fetchConfig();
  }, [API_URL, product.slug]);

  // Dynamic Pricing Calculation
  const calculatePricing = useCallback(async () => {
    if (!selections.size || !selections.material || !selections.quality) return;
    
    setIsPricingLoading(true);
    try {
      const res = await fetch(`${API_URL}/pricing/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          ...selections,
          personalizations: selections.personalizations.map(p => ({ code: p.code }))
        }),
      });
      
      if (!res.ok) throw new Error('Pricing error');
      const data = await res.json();
      
      if (data) {
        setCalculatedPrice(data.unitPrice || product.basePrice);
        if (data.snapshot) {
          setConfigCode(data.snapshot.configCode);
          setPricingSnapshot(data.snapshot);
        }
      }
    } catch (err) {
      console.error('Pricing calculation error:', err);
    } finally {
      setIsPricingLoading(false);
    }
  }, [API_URL, product.id, product.basePrice, quantity, selections]);

  useEffect(() => {
    calculatePricing();
  }, [calculatePricing]);

  const handleAddToCart = () => {
    if (!selectedVariant.sku) return;
    
    addToCart(product, selectedVariant, quantity, selections, calculatedPrice, configCode);
    toast.success('Producto personalizado agregado al carrito');
  };

  const handleSelectionChange = (type: string, value: string) => {
    setSelections(prev => {
      // If material changes, validate current personalizations
      if (type === 'material') {
        const validPerso = prev.personalizations.filter(p => {
          const opt = config?.personalizationOptions.find(o => o.code === p.code);
          return !opt?.allowedMaterialValues?.length || opt.allowedMaterialValues.includes(value);
        });
        return { ...prev, [type]: value, personalizations: validPerso };
      }
      return { ...prev, [type]: value };
    });
  };

  const togglePersonalization = (opt: PersonalizationOption) => {
    setSelections(prev => {
      const exists = prev.personalizations.find(p => p.code === opt.code);
      if (exists) {
        return { ...prev, personalizations: prev.personalizations.filter(p => p.code !== opt.code) };
      } else {
        return { ...prev, personalizations: [...prev.personalizations, { code: opt.code, options: [] }] };
      }
    });
  };

  const allImages = [
    ...(selectedVariant?.imageUrl ? [{ url: selectedVariant.imageUrl, id: 'variant-img' }] : []),
    ...(product.images || [])
  ];

  const currentImageUrl = allImages[currentImageIndex]?.url || '/placeholder.svg';

  const groupedAttributes = (config?.attributes || []).reduce((acc, attr) => {
    if (!acc[attr.type]) acc[attr.type] = [];
    acc[attr.type].push(attr);
    return acc;
  }, {} as Record<string, Attribute[]>) || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
      {/* Left: Image Gallery */}
      <div className="space-y-4">
        <div className="relative aspect-[3/4] bg-surface rounded-sm overflow-hidden">
          <Image src={currentImageUrl} alt={product.name} fill className="object-cover" priority />
        </div>
        {allImages.length > 1 && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {allImages.map((img, idx) => (
              <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`relative w-20 h-20 shrink-0 border-2 ${currentImageIndex === idx ? 'border-primary' : 'border-transparent'}`}>
                <Image src={img.url} alt={`Thumb ${idx}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Product Info */}
      <div className="flex flex-col h-full">
        <div className="mb-2">
           <span className="text-xs font-bold uppercase tracking-widest text-secondary mb-2 block">
             {product.collection?.name || 'Colección'}
           </span>
           <h1 className="text-3xl md:text-4xl font-serif text-primary leading-tight">{product.name}</h1>
        </div>

        <div className="flex items-center gap-4 mb-8 border-b border-theme pb-6">
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-primary">
              ${calculatedPrice.toLocaleString('es-CO')}
            </span>
            {isPricingLoading && <div className="flex items-center gap-1 text-[10px] text-muted animate-pulse mt-1"><Loader2 size={10} className="animate-spin" /> Actualizando precio...</div>}
          </div>
          {configCode && (
            <div className="px-2 py-1 bg-slate-100 text-[9px] font-mono text-slate-500 rounded border border-slate-200 uppercase tracking-tighter" title="Configuración de Producción">
              CODE: {configCode}
            </div>
          )}
        </div>

        <div className="space-y-8 mb-10">
          {/* Dynamic Selectors */}
          {['SIZE', 'QUALITY', 'MATERIAL'].map((type) => (
            <div key={type}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">
                {type === 'SIZE' ? 'TAMAÑO' : type === 'QUALITY' ? 'CALIDAD' : 'MATERIAL'}:
                <span className="ml-2 text-slate-900 font-bold uppercase">
                  {(selections[type.toLowerCase() as keyof typeof selections] as string) || '...'}
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {groupedAttributes[type]?.map((attr) => (
                  <button
                    key={attr.value}
                    onClick={() => handleSelectionChange(type.toLowerCase(), attr.value)}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest border transition-all ${
                      selections[type.toLowerCase() as keyof typeof selections] === attr.value
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-theme text-muted hover:border-primary hover:text-primary'
                    }`}
                  >
                    {attr.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Personalization Options */}
          {config?.personalizationOptions && config.personalizationOptions.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">Personalización Extra:</span>
              <div className="flex flex-wrap gap-3">
                {config.personalizationOptions.map((opt) => {
                  const isCompatible = !opt.allowedMaterialValues?.length || opt.allowedMaterialValues.includes(selections.material);
                  const isSelected = !!selections.personalizations.find(p => p.code === opt.code);

                  if (!isCompatible) return null;

                  return (
                    <button
                      key={opt.code}
                      onClick={() => togglePersonalization(opt)}
                      className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                        isSelected 
                          ? 'bg-secondary border-secondary text-white shadow-md' 
                          : 'bg-white border-theme text-muted hover:border-secondary hover:text-secondary'
                      }`}
                    >
                      {opt.name} (+${opt.basePrice.toLocaleString()})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color Selector (Variants) */}
          {product.variants.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">Color:</span>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((variant) => (
                  <button
                    key={variant.sku}
                    onClick={() => {
                        setSelectedVariant(variant);
                        const variantImgIdx = allImages.findIndex(img => img.url === variant.imageUrl);
                        if (variantImgIdx !== -1) setCurrentImageIndex(variantImgIdx);
                    }}
                    className={`w-8 h-8 rounded-full border border-theme ring-2 ring-offset-2 transition-all ${
                      selectedVariant.sku === variant.sku ? 'ring-primary' : 'ring-transparent'
                    }`}
                    style={{ backgroundColor: getVariantColorHex(variant.color) }}
                    title={variant.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-theme">
            <div className="flex items-center border border-theme rounded-lg bg-white h-14">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-5 hover:bg-slate-50 h-full"><Minus size={16} /></button>
              <span className="w-12 text-center font-bold text-sm">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="px-5 hover:bg-slate-50 h-full"><Plus size={16} /></button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={selectedVariant.stock === 0 || isPricingLoading}
              className="flex-1 bg-primary text-white font-black uppercase tracking-[0.2em] py-4 px-8 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <ShoppingBag className="w-5 h-5" />
              {selectedVariant.stock === 0 ? 'Agotado' : 'Añadir al Carrito'}
            </button>
          </div>
        </div>

        {/* Info Cards */}
        {pricingSnapshot?.minPriceGuardApplied && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded flex gap-3 text-amber-800 text-[11px]">
            <AlertCircle size={16} className="shrink-0" />
            <p>Se ha aplicado la tarifa base mínima para esta configuración.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 py-8 border-t border-theme text-xs text-muted">
           <div className="flex items-start gap-3">
             <Truck className="w-5 h-5 text-secondary shrink-0" />
             <div><span className="font-bold text-primary block mb-0.5">Envío Nacional</span><p>Entregas en 3-5 días hábiles.</p></div>
           </div>
           <div className="flex items-start gap-3">
             <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
             <div><span className="font-bold text-primary block mb-0.5">Marca Dual</span><p>Garantía de producción bajo pedido o stock inmediato.</p></div>
           </div>
        </div>
      </div>
    </div>
  );
}

function getVariantColorHex(colorName: string): string {
  const map: Record<string, string> = {
    'negro': '#000000', 'blanco': '#FFFFFF', 'crudo': '#F5F5DC', 'beige': '#D2B48C',
    'azul': '#1e3a8a', 'verde': '#166534', 'rojo': '#991b1b', 'rosa': '#f472b6', 'amarillo': '#facc15',
  };
  return map[colorName.toLowerCase()] || '#cccccc';
}
