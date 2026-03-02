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
  Briefcase,
  Box
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Product } from '@/types/product';

interface WizardOption {
  id: string;
  category: string;
  name: string;
  code: string;
  description?: string;
  basePriceModifier: number;
  allowedMaterialValues?: string[];
  imageUrl?: string;
}

interface GroupedOptions {
  LINE: WizardOption[];
  DIMENSION: WizardOption[];
  MATERIAL: WizardOption[];
  QUALITY: WizardOption[];
  TECHNIQUE: WizardOption[];
}

interface PersonalizerWizardProps {
  productId: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

// Icon mapping helper
const getLineIcon = (code: string) => {
  if (code.includes('ECO')) return Leaf;
  if (code.includes('COMERCIAL')) return ShoppingBag;
  if (code.includes('PREMIUM')) return Star;
  if (code.includes('CORPORATIVA')) return Briefcase;
  return Box;
};

export default function PersonalizerWizard({ productId }: PersonalizerWizardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const supabase = createClient();
  
  const [step, setStep] = useState<Step>(1);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  
  // Dynamic Options State
  const [wizardOptions, setWizardOptions] = useState<GroupedOptions | null>(null);

  // Selection State
  const [selections, setSelections] = useState({
    line: '',
    size: '',
    material: '',
    quantity: 1,
    markingType: '',
    designUrl: '',
    customFile: null as File | null,
  });

  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(50);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [configCode, setConfigCode] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

  // 1. Fetch Dynamic Options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const res = await fetch(`${API_URL}/wizard-options/grouped`);
        if (!res.ok) throw new Error('Error al cargar opciones del configurador');
        const resBody = await res.json();
        const data = resBody.data as GroupedOptions;
        setWizardOptions(data);

        // Auto-select first options as defaults
        setSelections(prev => ({
          ...prev,
          line: data.LINE?.[0]?.code || '',
          size: data.DIMENSION?.[0]?.name || '',
          material: data.MATERIAL?.[0]?.name || '',
          markingType: data.TECHNIQUE?.[0]?.code || '',
        }));
      } catch (err) {
        console.error(err);
        toast.error('No se pudo inicializar el configurador');
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [API_URL]);

  // 2. Real-time Pricing Logic
  const fetchPricing = useCallback(async () => {
    if (!selections.size || !selections.material || !wizardOptions) return;
    
    setIsPricingLoading(true);
    try {
      // We use the quote endpoint which is already designed for this
      const res = await fetch(`${API_URL}/pricing/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          line: selections.line,
          size: selections.size,
          material: selections.material,
          quantity: Number(selections.quantity),
          personalizations: (selections.designUrl || uploadedLogo) ? [{ code: 'LOGO', options: [selections.markingType] }] : []
        })
      });
      
      if (!res.ok) {
        const errBody = await res.json();
        console.error('[Pricing Error Details]:', errBody);
        throw new Error(errBody.message || 'Pricing error');
      }
      const body = await res.json();
      setCalculatedPrice(body.data.unitPrice);
      setConfigCode(body.data.snapshot.configCode);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPricingLoading(false);
    }
  }, [API_URL, selections, productId, wizardOptions, uploadedLogo]);

  useEffect(() => {
    if (step > 1 && wizardOptions) fetchPricing();
  }, [fetchPricing, step, selections.quantity, wizardOptions]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo supera los 5MB permitidos');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadedLogo(previewUrl);
    setSelections(prev => ({ ...prev, customFile: file }));
    toast.success('Diseño cargado para previsualización');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo supera los 5MB permitidos');
      return;
    }

    setIsPricingLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `designs/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('product-assets').getPublicUrl(fileName);
      setSelections(prev => ({ ...prev, designUrl: data.publicUrl }));
      toast.success('Diseño cargado');
    } catch {
      toast.error('Error al subir el archivo');
    } finally {
      setIsPricingLoading(false);
    }
  };

  const nextStep = () => setStep(prev => (prev < 5 ? (prev + 1) as Step : prev));
  const prevStep = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  const handleFinish = () => {
    addToCart(
      { 
        id: productId, 
        name: 'Tote Bag Personalizada', 
        basePrice: calculatedPrice,
        slug: 'custom-tote',
        description: 'Tote bag configurada dinámicamente',
        images: [],
        variants: [],
        tags: []
      } as unknown as Product,
      { sku: `CUSTOM-${configCode}`, color: 'Custom', imageUrl: selections.designUrl || uploadedLogo || '', stock: 999 },
      selections.quantity,
      { ...selections, configCode },
      calculatedPrice,
      configCode
    );
    router.push('/checkout');
  };

  if (loadingOptions) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-40 gap-4 shadow-xl">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted">Construyendo tu experiencia...</p>
      </div>
    );
  }

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
                {wizardOptions?.LINE.map(line => {
                  const Icon = getLineIcon(line.code);
                  return (
                    <button
                      key={line.id}
                      onClick={() => setSelections(prev => ({ ...prev, line: line.code }))}
                      className={`flex items-center gap-6 p-6 rounded-2xl border-2 transition-all text-left group ${selections.line === line.code ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selections.line === line.code ? 'bg-primary text-white' : 'bg-base text-primary group-hover:bg-primary/10'}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">{line.name}</h4>
                        <p className="text-xs text-muted">{line.description}</p>
                      </div>
                      {selections.line === line.code && <Check className="ml-auto text-primary" size={20} />}
                    </button>
                  );
                })}
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
                {wizardOptions?.DIMENSION.map(dim => (
                  <button
                    key={dim.id}
                    onClick={() => setSelections(prev => ({ ...prev, size: dim.name }))}
                    className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${selections.size === dim.name ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                  >
                    <div 
                      className={`w-16 h-20 border-2 rounded-lg transition-all ${selections.size === dim.name ? 'border-primary bg-primary/20' : 'border-muted opacity-30'}`} 
                      style={{ transform: `scale(${dim.name.toLowerCase().includes('peque') ? 0.75 : dim.name.toLowerCase().includes('grand') ? 1.2 : 1})` }} 
                    />
                    <span className="font-black uppercase tracking-widest text-[10px]">{dim.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Material */}
          {step === 3 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="space-y-4">
                <h3 className="text-2xl font-serif text-primary mb-2">Material Base</h3>
                <p className="text-muted text-sm">Elige la textura y resistencia para tu tote bag.</p>
                <div className="flex flex-wrap gap-3 mt-6">
                  {wizardOptions?.MATERIAL.map(mat => (
                    <button
                      key={mat.id}
                      onClick={() => setSelections(prev => ({ ...prev, material: mat.name }))}
                      className={`px-6 py-3 rounded-full border-2 font-bold text-xs transition-all ${selections.material === mat.name ? 'bg-primary border-primary text-white' : 'border-theme text-muted'}`}
                    >
                      {mat.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Step 4: Personalization */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Area de Controles (Izquierda) */}
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-serif text-primary mb-2">Personaliza tu Tote</h3>
                    <p className="text-muted text-sm">Sube tu logo y elige la técnica de marcado.</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">1. Sube tu diseño</h4>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-theme rounded-2xl flex items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <Upload size={20} className="text-muted group-hover:text-primary" />
                      <span className="text-sm font-bold text-primary">Cargar Imagen (.png, .jpg)</span>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                      />
                    </button>
                    {uploadedLogo && (
                      <div className="mt-4 p-4 bg-base/50 rounded-2xl border border-theme animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">Tamaño del Diseño</label>
                          <span className="text-[10px] font-bold text-muted">{logoScale}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="100" 
                          value={logoScale} 
                          onChange={(e) => setLogoScale(Number(e.target.value))} 
                          className="w-full h-1.5 bg-theme rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted uppercase text-center">Recomendado: Fondo transparente</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">2. Técnica de Marcado</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const available = wizardOptions?.TECHNIQUE.filter(t => 
                          !t.allowedMaterialValues || 
                          t.allowedMaterialValues.length === 0 || 
                          t.allowedMaterialValues.includes(selections.material)
                        ) || [];

                        if (available.length === 0) {
                          return (
                            <div className="col-span-2 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                              <AlertCircle className="text-red-500 shrink-0" size={16} />
                              <p className="text-[10px] font-medium text-red-700">
                                No compatible con {selections.material}.
                              </p>
                            </div>
                          );
                        }

                        return available.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelections(prev => ({ ...prev, markingType: t.code }))}
                            className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${selections.markingType === t.code ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted hover:border-primary/30'}`}
                          >
                            {t.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Area de Previsualización (Derecha) */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-sm aspect-[4/6] bg-gray-100 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                    {/* Mockup Base Dinámico */}
                    {(() => {
                      const selectedMaterial = wizardOptions?.MATERIAL.find(m => m.name === selections.material);
                      const canvasImage = selectedMaterial?.imageUrl || '/placeholder.svg';
                      
                      return (
                        <Image 
                          src={canvasImage} 
                          alt="Tote Mockup" 
                          fill 
                          className="object-cover transition-opacity duration-500"
                        />
                      );
                    })()}
                    
                    {/* Print Area Overlay */}
                    <div className="absolute top-[44%] left-[28%] w-[45%] h-[35%] border-2 border-dashed border-gray-400/50 rounded-lg flex items-center justify-center z-10 overflow-hidden">
                      {uploadedLogo ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                          <img 
                            src={uploadedLogo} 
                            alt="Logo preview" 
                            style={{ width: `${logoScale}%`, height: 'auto', objectFit: 'contain' }}
                            className="animate-in zoom-in-50 duration-300 transition-all"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-4">Área de impresión</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest">Vista Previa Interactiva</p>
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
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">Técnica</p>
                    <p className="font-bold text-primary">
                      {wizardOptions?.TECHNIQUE.find(t => t.code === selections.markingType)?.name || selections.markingType}
                    </p>
                  </div>
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
            </div>
          )}
        </div>

        {/* Footer Navigation */}
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
              disabled={isPricingLoading || (step === 2 && !selections.size) || (step === 3 && !selections.material)}
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
