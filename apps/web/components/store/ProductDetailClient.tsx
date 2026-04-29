'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Product, Variant } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { apiFetch } from '@/utils/api';
import { Minus, Plus, ShoppingBag, Truck, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatWholeCurrency } from '@/lib/numeric-input';

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
  allowedMaterialValues?: string[];
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

function normalizeConfigCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const showExtraPersonalization = false;
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const activeVariants = product.variants.filter((variant) => variant.isActive !== false);
  const fallbackVariant =
    activeVariants
      .filter((variant) => typeof variant.salePrice === 'number')
      .sort((left, right) => (left.salePrice ?? 0) - (right.salePrice ?? 0))[0]
    || activeVariants[0]
    || product.variants[0]
    || ({} as Variant);
  const fallbackVariantPrice = fallbackVariant.salePrice ?? product.basePrice;
  const [activeTab, setActiveTab] = useState<'description' | 'shipping'>('description');
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant>(fallbackVariant);

  const [selections, setSelections] = useState({
    size: fallbackVariant.size || '',
    material: product.attributes?.find(a => a.type === 'MATERIAL' && a.isActive)?.value || '',
    quality: product.attributes?.find(a => a.type === 'QUALITY' && a.isActive)?.value || '',
    line: product.attributes?.find(a => a.type === 'LINE' && a.isActive)?.value || 'COMERCIAL',
    personalizations: [] as Array<{ code: string; options: string[] }>,
  });

  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(
    fallbackVariantPrice,
  );
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [configCode, setConfigCode] = useState<string | undefined>();
  const [pricingSnapshot, setPricingSnapshot] = useState<PricingSnapshot | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiFetch(`/catalog/products/${product.slug}/config`);
        if (!res.ok) throw new Error('Failed to load config');
        const responseBody = await res.json();
        const data = responseBody.data || responseBody;

        const transformedOptions = ((data.personalizationOptions as ApiPersonalizationOption[]) || []).map(opt => ({
          ...opt,
          allowedMaterialValues: opt.rule?.allowedMaterialValues || []
        }));

        setConfig({
          attributes: data.attributes || [],
          personalizationOptions: transformedOptions
        });

        const attrs = (data.attributes as Attribute[]) || [];
        const defaultMaterial = attrs.find((a) => a.type === 'MATERIAL')?.value;
        const defaultQuality = attrs.find((a) => a.type === 'QUALITY')?.value;
        const defaultLine = attrs.find((a) => a.type === 'LINE')?.value;

        setSelections(prev => ({
          ...prev,
          material: defaultMaterial || prev.material,
          quality: defaultQuality || prev.quality,
          line: defaultLine || prev.line || 'COMERCIAL',
        }));
      } catch (err) {
        console.error('Config fetch error:', err);
      }
    };
    fetchConfig();
  }, [product.slug]);

  const calculatePricing = useCallback(async () => {
    if (!selectedVariant.id || !selections.material) return;

    setIsPricingLoading(true);
    try {
      const res = await apiFetch('/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          quantity,
          ...selections,
          size: selectedVariant.size || selections.size,
          personalizations: selections.personalizations.map(p => ({ 
            code: p.code,
            options: p.options || [] 
          }))
        }),
      });

      if (!res.ok) throw new Error('Pricing error');
      const responseBody = await res.json();
      const data = responseBody.data || responseBody;

      if (data) {
        setCalculatedPrice(
          data.unitPrice || selectedVariant.salePrice || fallbackVariantPrice,
        );
        if (data.snapshot) {
          setConfigCode(normalizeConfigCode(data.snapshot.configCode));
          setPricingSnapshot(data.snapshot);
        } else {
          setConfigCode(undefined);
        }
      }
    } catch (err) {
      console.error('Pricing calculation error:', err);
      setCalculatedPrice(selectedVariant.salePrice ?? fallbackVariantPrice);
      setConfigCode(undefined);
    } finally {
      setIsPricingLoading(false);
    }
  }, [fallbackVariantPrice, product.id, quantity, selections, selectedVariant.id, selectedVariant.salePrice, selectedVariant.size]);

  useEffect(() => {
    calculatePricing();
  }, [calculatePricing]);

  useEffect(() => {
    setSelections((prev) => ({
      ...prev,
      size: selectedVariant.size || prev.size,
    }));
  }, [selectedVariant.size]);

  const handleAddToCart = () => {
    if (!selectedVariant.sku) return;

    addToCart(product, selectedVariant, quantity, selections, calculatedPrice, configCode);
    toast.success(t('product_config_added'));
  };

  const handleSelectionChange = (type: string, value: string) => {
    setSelections(prev => {
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
      }
      return { ...prev, personalizations: [...prev.personalizations, { code: opt.code, options: [] }] };
    });
  };

  const mainImages = [...(product.images || [])]
    .sort((left, right) => left.position - right.position)
    .map(img => ({ url: img.url, id: img.id || Math.random().toString() }));
  const variantImages = activeVariants
    .map(v => v.imageUrl ? { url: v.imageUrl, id: v.sku } : null)
    .filter(Boolean) as Array<{ url: string, id: string }>;
  const allImages = [...mainImages, ...variantImages];
  const currentImageUrl = allImages[currentImageIndex]?.url || '/placeholder.svg';
  const productDescription = product.description?.trim() || 'Este producto no tiene una descripcion disponible por ahora.';
  const uniqueSizes = Array.from(new Set(activeVariants.map((variant) => variant.size).filter(Boolean))) as string[];
  const variantsForSelectedSize = selections.size
    ? activeVariants.filter((variant) => variant.size === selections.size)
    : activeVariants;
  const colorOptions = variantsForSelectedSize.length > 0 ? variantsForSelectedSize : activeVariants;
  const groupedAttributes = (config?.attributes || []).reduce((acc, attr) => {
    if (!acc[attr.type]) acc[attr.type] = [];
    acc[attr.type].push(attr);
    return acc;
  }, {} as Record<string, Attribute[]>) || {};

  return (
    <div className="space-y-12 lg:space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <div className="space-y-4">
          <div className="relative aspect-[3/4] bg-surface rounded-sm overflow-hidden">
            <Image
              src={currentImageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`relative w-20 h-20 shrink-0 border-2 ${currentImageIndex === idx ? 'border-primary' : 'border-transparent'}`}>
                  <Image
                    src={img.url}
                    alt={`Thumb ${idx}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col h-full">
          <div className="mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary mb-2 block">
              {product.collection?.name || t('product_collection_fallback')}
            </span>
            <h1 className="text-3xl md:text-4xl font-serif text-primary leading-tight">{product.name}</h1>
          </div>

          <div className="flex items-center gap-4 mb-8 border-b border-theme pb-6">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary">
                {formatWholeCurrency(calculatedPrice)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                IVA incluido
              </span>
              {typeof selectedVariant.comparePrice === 'number' && selectedVariant.comparePrice > calculatedPrice && (
                <span className="text-sm text-muted line-through">
                  {formatWholeCurrency(selectedVariant.comparePrice)}
                </span>
              )}
              {isPricingLoading && <div className="flex items-center gap-1 text-[10px] text-muted animate-pulse mt-1"><Loader2 size={10} className="animate-spin" /> {t('product_updating_price')}</div>}
            </div>
            {configCode && (
              <div className="px-2 py-1 bg-slate-100 text-[9px] font-mono text-slate-500 rounded border border-slate-200 uppercase tracking-tighter" title={t('product_config_title')}>
                CODE: {configCode}
              </div>
            )}
          </div>

          <div className="space-y-8 mb-10">
            {uniqueSizes.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">
                  {t('product_size')}:
                  <span className="ml-2 text-slate-900 font-bold uppercase">
                    {selectedVariant.size || selections.size || '...'}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {uniqueSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        const nextVariant =
                          activeVariants.find((variant) => variant.size === size && variant.color === selectedVariant.color)
                          || activeVariants.find((variant) => variant.size === size)
                          || fallbackVariant;
                        setSelectedVariant(nextVariant);
                        setSelections((prev) => ({ ...prev, size }));
                      }}
                      className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest border transition-all ${
                        (selectedVariant.size || selections.size) === size
                          ? 'bg-primary border-primary text-white'
                          : 'bg-white border-theme text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {['MATERIAL'].map((type) => (
              <div key={type}>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">
                  {t('product_material')}:
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

            {showExtraPersonalization && config?.personalizationOptions && config.personalizationOptions.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">{t('product_extra_personalization')}</span>
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
                          isSelected ? 'bg-secondary border-secondary text-white shadow-md' : 'bg-white border-theme text-muted hover:border-secondary hover:text-secondary'
                        }`}
                      >
                        {opt.name} (+{formatWholeCurrency(opt.basePrice)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {colorOptions.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">{t('product_color')}</span>
                <div className="flex flex-wrap gap-3">
                  {colorOptions.map((variant) => (
                    <button
                      key={variant.sku}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setSelections((prev) => ({
                          ...prev,
                          size: variant.size || prev.size,
                        }));

                        if (variant.imageUrl) {
                          const variantImageIndex = allImagesRef(variant.imageUrl, product);
                          if (variantImageIndex >= 0) {
                            setCurrentImageIndex(variantImageIndex);
                          }
                        }
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

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-theme">
              <div className="flex items-center border border-theme rounded-lg bg-white h-14">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-5 hover:bg-slate-50 h-full"><Minus size={16} /></button>
                <span className="w-12 text-center font-bold text-sm">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} className="px-5 hover:bg-slate-50 h-full"><Plus size={16} /></button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!selectedVariant.id || selectedVariant.stock === 0 || isPricingLoading}
                className="flex-1 bg-primary text-white font-black uppercase tracking-[0.2em] py-4 px-8 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <ShoppingBag className="w-5 h-5" />
                {selectedVariant.stock === 0 ? t('product_sold_out') : t('product_add_to_cart_button')}
              </button>
            </div>
          </div>

          {pricingSnapshot?.minPriceGuardApplied && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded flex gap-3 text-amber-800 text-[11px]">
              <AlertCircle size={16} className="shrink-0" />
              <p>{t('product_min_base_rate')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 py-8 border-t border-theme text-xs text-muted">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-secondary shrink-0" />
              <div><span className="font-bold text-primary block mb-0.5">{t('product_shipping_title')}</span><p>{t('product_shipping_description')}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
              <div><span className="font-bold text-primary block mb-0.5">{t('product_dual_brand_title')}</span><p>{t('product_dual_brand_description')}</p></div>
            </div>
          </div>
        </div>
      </div>

      <section className="border-t border-theme pt-8">
        <div className="flex flex-wrap items-center gap-8 md:gap-12">
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`text-2xl md:text-4xl transition-colors ${activeTab === 'description' ? 'text-secondary' : 'text-primary hover:text-secondary'}`}
          >
            Descripcion
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shipping')}
            className={`text-2xl md:text-4xl transition-colors ${activeTab === 'shipping' ? 'text-secondary' : 'text-primary hover:text-secondary'}`}
          >
            Detalles Del Envio
          </button>
        </div>

        <div className="mt-8 border-t border-theme/80 pt-8 min-h-[180px] text-sm md:text-base text-muted">
          {activeTab === 'description' && (
            <div className="max-w-4xl whitespace-pre-line leading-7">
              {productDescription}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="grid gap-5 md:grid-cols-2 max-w-4xl">
              <div className="rounded-sm border border-theme bg-white p-5">
                <p className="text-primary font-semibold mb-2">{t('product_shipping_title')}</p>
                <p className="leading-7">{t('product_shipping_description')}</p>
              </div>
              <div className="rounded-sm border border-theme bg-white p-5">
                <p className="text-primary font-semibold mb-2">{t('product_dual_brand_title')}</p>
                <p className="leading-7">{t('product_dual_brand_description')}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getVariantColorHex(colorName: string): string {
  const map: Record<string, string> = {
    'negro': '#000000', 'blanco': '#FFFFFF', 'crudo': '#F5F5DC', 'beige': '#D2B48C',
    'azul': '#1e3a8a', 'verde': '#166534', 'rojo': '#991b1b', 'rosa': '#f472b6', 'amarillo': '#facc15',
  };
  return map[colorName?.toLowerCase?.()] || '#cccccc';
}

function allImagesRef(imageUrl: string, product: Product) {
  const mainImages = [...(product.images || [])]
    .sort((left, right) => left.position - right.position)
    .map((img) => img.url);
  const variantImages = (product.variants || [])
    .filter((variant) => variant.isActive !== false)
    .map((variant) => variant.imageUrl)
    .filter(Boolean);

  return [...mainImages, ...variantImages].findIndex((url) => url === imageUrl);
}
