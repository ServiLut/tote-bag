'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/utils/supabase/client';
import { 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  Check, 
  Loader2, 
  AlertCircle, 
  Truck,
  Leaf,
  ShoppingBag,
  Star,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Product } from '@/types/product';

interface PersonalizerWizardProps {
  productId: string;
}

interface Attribute {
  type: string;
  value: string;
  priceModifier: number;
}

interface ProductConfig {
  productId: string;
  attributes: Attribute[];
  product?: Product;
}

interface PricingSnapshot {
  configCode: string;
  minPriceGuardApplied: boolean;
  [key: string]: unknown;
}

type Step = 1 | 2 | 3 | 4 | 5;

const LINES = [
  { id: 'ECO', name: 'Línea ECO', icon: Leaf, description: 'Materiales reciclados y ecológicos.' },
  { id: 'COMERCIAL', name: 'Línea COMERCIAL', icon: ShoppingBag, description: 'Ideal para retail y uso diario.' },
  { id: 'PREMIUM', name: 'Línea PREMIUM', icon: Star, description: 'Alta gama con acabados de lujo.' },
  { id: 'CORPORATIVA', name: 'Línea CORPORATIVA', icon: Briefcase, description: 'Producción masiva y B2B.' },
];

export default function PersonalizerWizard({ productId }: PersonalizerWizardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const supabase = createClient();
  
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  
  // Selection State
  const [selections, setSelections] = useState({
    line: 'COMERCIAL',
    size: '',
    material: '',
    quality: '',
    quantity: 1,
    markingType: 'Estampado',
    designUrl: '',
  });

  // Config State
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [pricingSnapshot, setPricingSnapshot] = useState<PricingSnapshot | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

  // Fetch Product Config
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/catalog/products/tote-bag-clasica/config`); 
        if (!res.ok) throw new Error('Error al cargar configuración');
        const data = await res.json();
        setConfig(data);
        
        // Initialize defaults with defensive checks
        const attrs = (data.attributes as Attribute[]) || [];
        const defaultSize = attrs.find((a) => a.type === 'SIZE')?.value || '';
        const defaultMat = attrs.find((a) => a.type === 'MATERIAL')?.value || '';
        const defaultQual = attrs.find((a) => a.type === 'QUALITY')?.value || '';
        
        setSelections(prev => ({
          ...prev,
          size: defaultSize,
          material: defaultMat,
          quality: defaultQual
        }));
      } catch (err) {
        console.error(err);
        toast.error('No se pudo cargar la configuración del producto');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [API_URL]);

  // Real-time Pricing
  const fetchPricing = useCallback(async () => {
    if (!selections.size || !selections.material || !selections.quality) return;
    
    setIsPricingLoading(true);
    try {
      const res = await fetch(`${API_URL}/pricing/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: config?.productId || productId,
          ...selections,
          personalizations: selections.designUrl ? [{ code: 'LOGO', options: [selections.markingType] }] : []
        })
      });
      
      if (!res.ok) throw new Error('Pricing error');
      const data = await res.json();
      setCalculatedPrice(data.unitPrice);
      setPricingSnapshot(data.snapshot);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPricingLoading(false);
    }
  }, [API_URL, selections, productId, config?.productId]);

  useEffect(() => {
    if (step > 1) fetchPricing();
  }, [fetchPricing, step, selections.quantity]);

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo supera los 5MB permitidos');
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `designs/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-assets')
        .getPublicUrl(fileName);

      setSelections(prev => ({ ...prev, designUrl: data.publicUrl }));
      toast.success('Diseño cargado correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al subir el archivo');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(prev => (prev < 5 ? (prev + 1) as Step : prev));
  const prevStep = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  const handleFinish = () => {
    const cartItemConfig = {
      ...selections,
      personalizations: selections.designUrl ? [{ code: 'LOGO', options: [selections.markingType, selections.designUrl] }] : []
    };

    addToCart(
      config?.product || { id: productId, name: 'Tote Bag Personalizada', basePrice: calculatedPrice },
      { sku: `CUSTOM-${pricingSnapshot?.configCode}`, color: 'Custom', imageUrl: selections.designUrl || '', stock: 999 },
      selections.quantity,
      cartItemConfig,
      calculatedPrice,
      pricingSnapshot?.configCode
    );
    
    toast.success('Configuración agregada al carrito');
    router.push('/checkout');
  };

  if (loading && step === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted font-medium">Cargando configurador...</p>
      </div>
    );
  }

  const groupedAttrs = config?.attributes?.reduce((acc: Record<string, Attribute[]>, attr) => {
    if (!acc[attr.type]) acc[attr.type] = [];
    acc[attr.type].push(attr);
    return acc;
  }, {}) || {};

  return (
    <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">
      
      {/* Sidebar - Progress */}
      <aside className="w-full md:w-1/3 bg-primary p-8 text-base-color flex flex-col justify-between">
        <div>
          <div className="mb-10">
            <h2 className="text-2xl font-serif font-bold">Personalizador</h2>
            <p className="text-base-color/60 text-sm">Paso {step} de 5</p>
          </div>
          
          <nav className="space-y-6">
            {[
              { s: 1, label: 'Línea de Producción' },
              { s: 2, label: 'Dimensiones' },
              { s: 3, label: 'Material y Calidad' },
              { s: 4, label: 'Personalización' },
              { s: 5, label: 'Resumen Final' }
            ].map(item => (
              <div key={item.s} className={`flex items-center gap-4 transition-all ${step === item.s ? 'opacity-100 translate-x-2' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black ${step === item.s ? 'bg-accent border-accent' : 'border-base-color'}`}>
                  {step > item.s ? <Check size={14} /> : item.s}
                </div>
                <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 p-6 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">Precio Estimado</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${calculatedPrice.toLocaleString('es-CO')}</span>
            <span className="text-[10px] opacity-60">COP / UNIDAD</span>
          </div>
          {isPricingLoading && <Loader2 size={12} className="animate-spin mt-2" />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 flex flex-col">
        
        <div className="flex-grow">
          {/* Step 1: Line */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">¿Cuál es tu línea ideal?</h3>
                <p className="text-muted text-sm">Cada línea define el propósito y acabado de tu tote bag.</p>
              </div>
              <div className="grid gap-4">
                {LINES.map(line => (
                  <button
                    key={line.id}
                    onClick={() => setSelections(prev => ({ ...prev, line: line.id }))}
                    className={`flex items-center gap-6 p-6 rounded-2xl border-2 transition-all text-left group ${selections.line === line.id ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selections.line === line.id ? 'bg-primary text-white' : 'bg-base text-primary group-hover:bg-primary/10'}`}>
                      <line.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-primary">{line.name}</h4>
                      <p className="text-xs text-muted">{line.description}</p>
                    </div>
                    {selections.line === line.id && <Check className="ml-auto text-primary" size={20} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Size */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">Elige el Tamaño</h3>
                <p className="text-muted text-sm">Dimensiones adaptadas a cada necesidad.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {groupedAttrs['SIZE']?.map((attr: Attribute) => (
                  <button
                    key={attr.value}
                    onClick={() => setSelections(prev => ({ ...prev, size: attr.value }))}
                    className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${selections.size === attr.value ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                  >
                    <div className={`w-16 h-20 border-2 rounded-lg transition-all ${selections.size === attr.value ? 'border-primary bg-primary/20' : 'border-muted opacity-30'}`} style={{ transform: `scale(${attr.value === 'Mini' ? 0.7 : attr.value === 'XL' ? 1.2 : 1})` }} />
                    <span className="font-black uppercase tracking-widest text-[10px]">{attr.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Material & Quality */}
          {step === 3 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary">Material Base</h4>
                <div className="flex flex-wrap gap-3">
                  {groupedAttrs['MATERIAL']?.map((attr: Attribute) => (
                    <button
                      key={attr.value}
                      onClick={() => setSelections(prev => ({ ...prev, material: attr.value }))}
                      className={`px-6 py-3 rounded-full border-2 font-bold text-xs transition-all ${selections.material === attr.value ? 'bg-primary border-primary text-white' : 'border-theme text-muted'}`}
                    >
                      {attr.value}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary">Calidad de Confección</h4>
                <div className="grid gap-3">
                  {groupedAttrs['QUALITY']?.map((attr: Attribute) => (
                    <button
                      key={attr.value}
                      onClick={() => setSelections(prev => ({ ...prev, quality: attr.value }))}
                      className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${selections.quality === attr.value ? 'border-secondary bg-secondary/5' : 'border-theme'}`}
                    >
                      <span className="font-bold">{attr.value}</span>
                      {attr.priceModifier > 0 && <span className="text-[10px] font-black text-secondary">+{attr.priceModifier.toLocaleString('es-CO')}</span>}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Step 4: Personalization */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">Tu Diseño</h3>
                <p className="text-muted text-sm">Sube tu logo o ilustración (.png, .ai, .pdf).</p>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video border-2 border-dashed border-theme rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group overflow-hidden relative"
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".png,.ai,.pdf" onChange={handleFileUpload} />
                
                {selections.designUrl ? (
                  <>
                    <Image src={selections.designUrl} alt="Design preview" fill className="object-contain p-8" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-bold text-xs uppercase tracking-widest">Cambiar Archivo</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-base rounded-full flex items-center justify-center text-muted group-hover:text-primary transition-colors">
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm">Haz clic para subir</p>
                      <p className="text-[10px] text-muted uppercase tracking-tighter">Máximo 5MB</p>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary">Técnica de Marcado</h4>
                <div className="flex gap-4">
                  {['Estampado', 'Bordado'].map(t => (
                    <button
                      key={t}
                      onClick={() => setSelections(prev => ({ ...prev, markingType: t }))}
                      className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all ${selections.markingType === t ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div>
                <h3 className="text-3xl font-serif text-primary mb-2">¡Todo listo!</h3>
                <p className="text-muted text-sm">Revisa tu configuración técnica antes de continuar.</p>
              </div>

              <div className="bg-base/50 rounded-3xl p-8 border border-theme space-y-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">Línea</p><p className="font-bold text-primary">{selections.line}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">Tamaño</p><p className="font-bold text-primary">{selections.size}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">Material</p><p className="font-bold text-primary">{selections.material}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">Calidad</p><p className="font-bold text-primary">{selections.quality}</p></div>
                </div>
                
                <div className="pt-6 border-t border-theme flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="text-secondary" size={20} />
                    <div className="text-[10px] font-bold text-muted">
                      ENTREGA ESTIMADA: <br/>
                      <span className="text-primary uppercase">8-12 días hábiles</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted mb-1">CANTIDAD</p>
                    <div className="flex items-center gap-3 bg-white border border-theme rounded-xl px-3 py-1">
                      <button onClick={() => setSelections(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="p-1 hover:text-primary transition-colors"><ChevronLeft size={14} /></button>
                      <span className="font-black text-xs">{selections.quantity}</span>
                      <button onClick={() => setSelections(p => ({ ...p, quantity: p.quantity + 1 }))} className="p-1 hover:text-primary transition-colors"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>

              {pricingSnapshot?.minPriceGuardApplied && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 text-amber-800 text-[11px] font-medium leading-relaxed">
                  <AlertCircle size={18} className="shrink-0" />
                  Se ha aplicado la tarifa base mínima de producción para esta configuración.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation - Sticky on Mobile */}
        <div className="mt-auto flex gap-4 pt-8 border-t border-theme bg-surface sticky bottom-0 left-0 right-0 md:relative z-20 pb-4 md:pb-0">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="px-6 md:px-8 py-4 border-2 border-theme rounded-2xl text-primary font-black uppercase tracking-widest text-[10px] hover:bg-base transition-all flex items-center gap-2 bg-white"
            >
              <ChevronLeft size={16} /> <span className="hidden md:inline">Atrás</span>
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={nextStep}
              disabled={isPricingLoading || (step === 2 && !selections.size) || (step === 3 && (!selections.material || !selections.quality))}
              className="flex-1 px-8 py-4 bg-primary text-base-color rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              Continuar <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex-1 px-8 py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20"
            >
              Finalizar y Comprar <ChevronRight size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
