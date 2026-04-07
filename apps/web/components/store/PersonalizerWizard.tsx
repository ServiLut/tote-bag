'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';
import { ApiResponse } from '@/types/api';
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
  TECHNIQUE: WizardOption[];
}

interface PersonalizerWizardProps {
  productId?: string;
  productSlug?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;
type ProductResolution = {
  id: string;
  variant: {
    id: string;
    sku: string;
    color: string;
    imageUrl: string;
    stock: number;
  };
};

class ProductResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductResolutionError';
  }
}

const getLineIcon = (code: string) => {
  if (code.includes('ECO')) return Leaf;
  if (code.includes('COMERCIAL')) return ShoppingBag;
  if (code.includes('PREMIUM')) return Star;
  if (code.includes('CORPORATIVA')) return Briefcase;
  return Box;
};

const isOtherTechniqueOption = (option: WizardOption) => {
  const normalized = `${option.code} ${option.name}`.toLowerCase();
  return normalized.includes('cierre') || normalized.includes('boton') || normalized.includes('botón');
};

const getDimensionVisualLabel = (option: WizardOption) => {
  const candidate = option.description?.trim();
  return candidate ? candidate : option.name;
};

const resolveProductSelection = (product?: Partial<Product> | null): ProductResolution | null => {
  const variant = product?.variants?.[0];

  if (!product?.id || !variant?.id || !variant?.sku) {
    return null;
  }

  return {
    id: product.id,
    variant: {
      id: variant.id,
      sku: variant.sku,
      color: variant.color || 'Base',
      imageUrl: variant.imageUrl || '',
      stock: variant.stock || 0,
    },
  };
};

export default function PersonalizerWizard({
  productId,
  productSlug = 'tote-bag-clasica',
}: PersonalizerWizardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [wizardOptions, setWizardOptions] = useState<GroupedOptions | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState(productId ?? '');
  const [resolvedVariant, setResolvedVariant] = useState<{
    id: string;
    sku: string;
    color: string;
    imageUrl: string;
    stock: number;
  } | null>(null);

  const [selections, setSelections] = useState({
    line: '',
    size: '',
    material: '',
    quantity: 1,
    markingType: '',
    extraOptions: [] as string[],
    designUrl: '',
    customFile: null as File | null,
  });

  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(50);
  const [calculatedUnitPrice, setCalculatedUnitPrice] = useState(0);
  const [calculatedTotalPrice, setCalculatedTotalPrice] = useState(0);
  const [configCode, setConfigCode] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setResolvedProductId(productId ?? '');
  }, [productId]);

  useEffect(() => {
    if (resolvedProductId || !productSlug) return;

    const fetchBaseProduct = async () => {
      try {
        const res = await apiFetch(`/catalog/slug/${encodeURIComponent(productSlug)}`);

        if (res.ok) {
          const body = (await res.json()) as ApiResponse<Product>;
          const resolvedProduct = resolveProductSelection(body.data);

          if (!resolvedProduct) {
            throw new ProductResolutionError('Missing product id');
          }

          setResolvedProductId(resolvedProduct.id);
          setResolvedVariant(resolvedProduct.variant);
          return;
        }

        if (res.status !== 404) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const fallbackRes = await apiFetch('/catalog/products');
        if (!fallbackRes.ok) {
          throw new Error(`HTTP error! status: ${fallbackRes.status}`);
        }

        const fallbackBody = (await fallbackRes.json()) as ApiResponse<Product[]>;
        const fallbackProduct = fallbackBody.data.find((product) =>
          product.slug === productSlug || Boolean(resolveProductSelection(product)),
        );
        const resolvedFallback = resolveProductSelection(fallbackProduct);

        if (!resolvedFallback) {
          setOptionsError(t('wizard_unavailable'));
          return;
        }

        setResolvedProductId(resolvedFallback.id);
        setResolvedVariant(resolvedFallback.variant);
      } catch (error) {
        if (error instanceof ProductResolutionError) {
          setOptionsError(t('wizard_unavailable'));
          return;
        }

        console.error('Fetch base product error:', error);
        setOptionsError(t('wizard_unavailable'));
      }
    };

    void fetchBaseProduct();
  }, [productSlug, resolvedProductId, t]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        setOptionsError(null);
        const res = await apiFetch('/wizard-options/grouped');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
        }
        const resBody = await res.json();
        const data = resBody.data as GroupedOptions;
        setWizardOptions(data);
        const defaultMarking =
          data.TECHNIQUE?.find((option) => !isOtherTechniqueOption(option))?.code || '';

        setSelections(prev => ({
          ...prev,
          line: data.LINE?.[0]?.code || '',
          size: data.DIMENSION?.[0]?.name || '',
          material: data.MATERIAL?.[0]?.name || '',
          markingType: defaultMarking,
        }));
      } catch (err) {
        console.error('Fetch options error:', err);
        const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
        const message = isNetworkError
          ? t('wizard_connection_error')
          : t('wizard_init_error');

        setOptionsError(message);
        toast.error(message, {
          action: {
            label: t('retry'),
            onClick: () => window.location.reload(),
          },
        });
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [t]);

  useEffect(() => {
    return () => {
      if (uploadedLogo?.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedLogo);
      }
    };
  }, [uploadedLogo]);

  const fetchPricing = useCallback(async () => {
    if (!selections.size || !selections.material || !wizardOptions || loadingOptions) return;
    if (!resolvedProductId || !selections.line || !selections.size || !selections.material) return;

    setIsPricingLoading(true);
    try {
      const personalizationOptions: Array<{ code: string; options: string[] }> = [];
      if ((selections.designUrl || uploadedLogo) && selections.markingType) {
        personalizationOptions.push({
          code: selections.markingType,
          options: [selections.markingType]
        });
      }
      selections.extraOptions.forEach((optionCode) => {
        personalizationOptions.push({
          code: optionCode,
          options: [optionCode],
        });
      });

      const res = await apiFetch('/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: resolvedProductId,
          line: selections.line,
          size: selections.size,
          material: selections.material,
          quantity: Number(selections.quantity),
          personalizations: personalizationOptions
        })
      });

      if (!res.ok) {
        let errMessage = `Pricing error (${res.status})`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const parsed = JSON.parse(text) as {
                message?: string | string[];
                error?: string;
              };
              if (Array.isArray(parsed.message)) {
                errMessage = parsed.message.join(', ');
              } else if (typeof parsed.message === 'string') {
                errMessage = parsed.message;
              } else if (typeof parsed.error === 'string') {
                errMessage = parsed.error;
              }
            } catch {
              errMessage = text;
            }
          } else {
            errMessage = `Error ${res.status}: ${res.statusText}`;
          }
        } catch {
          errMessage = `Error ${res.status}: ${res.statusText}`;
        }
        console.warn('[Pricing Request Failed]', { status: res.status, message: errMessage });
        throw new Error(errMessage);
      }
      const body = await res.json();
      if (body.data) {
        setCalculatedUnitPrice(body.data.unitPrice);
        setCalculatedTotalPrice(body.data.total);
        if (body.data.snapshot) {
          setConfigCode(body.data.snapshot.configCode);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('wizard_price_error');
      console.warn('Pricing fetch failed:', message);
    } finally {
      setIsPricingLoading(false);
    }
  }, [selections, resolvedProductId, wizardOptions, uploadedLogo, loadingOptions, t]);

  useEffect(() => {
    if (step >= 1 && wizardOptions) fetchPricing();
  }, [fetchPricing, step, selections.quantity, wizardOptions]);

  useEffect(() => {
    if (!wizardOptions) return;

    const validTechniqueOptions = wizardOptions.TECHNIQUE.filter(
      (option) =>
        !isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    );

    const validOtherOptionCodes = wizardOptions.TECHNIQUE.filter(
      (option) =>
        isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    ).map((option) => option.code);

    setSelections((prev) => {
      const nextExtraOptions = prev.extraOptions.filter((code) =>
        validOtherOptionCodes.includes(code),
      );
      const nextMarkingType = validTechniqueOptions.some(
        (option) => option.code === prev.markingType,
      )
        ? prev.markingType
        : (validTechniqueOptions[0]?.code || '');

      if (
        nextMarkingType === prev.markingType &&
        nextExtraOptions.length === prev.extraOptions.length
      ) {
        return prev;
      }

      return {
        ...prev,
        markingType: nextMarkingType,
        extraOptions: nextExtraOptions,
      };
    });
  }, [wizardOptions, selections.material]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('wizard_file_too_large'));
      e.target.value = '';
      return;
    }

    if (uploadedLogo?.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedLogo);
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadedLogo(previewUrl);
    setSelections(prev => ({ ...prev, customFile: file, designUrl: '' }));
    setIsUploadingLogo(true);

    try {
      const signedUploadResponse = await apiFetch('/personalizations/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (!signedUploadResponse.ok) {
        const errorBody = await signedUploadResponse.json().catch(() => ({}));
        const message =
          typeof errorBody.message === 'string'
            ? errorBody.message
            : 'No se pudo persistir la imagen.';
        throw new Error(message);
      }

      const signedBody = (await signedUploadResponse.json()) as {
        data?: {
          path?: string;
          token?: string;
          publicUrl?: string;
        };
      };
      const uploadPath = signedBody.data?.path;
      const uploadToken = signedBody.data?.token;
      const publicUrl = signedBody.data?.publicUrl;

      if (!uploadPath || !uploadToken || !publicUrl) {
        throw new Error('No se recibio una autorizacion valida para cargar el diseno.');
      }

      const { error: uploadError } = await supabase.storage
        .from('product-assets')
        .uploadToSignedUrl(uploadPath, uploadToken, file);

      if (uploadError) {
        throw uploadError;
      }

      if (!publicUrl) {
        throw new Error('No se pudo obtener la URL publica del diseno.');
      }

      setSelections(prev => ({ ...prev, customFile: file, designUrl: publicUrl }));
      toast.success(t('wizard_design_uploaded'));
    } catch (error) {
      console.error('Custom design upload error:', error);
      setSelections(prev => ({ ...prev, customFile: null, designUrl: '' }));
      setUploadedLogo(null);
      toast.error('No se pudo persistir la imagen. Intenta subirla de nuevo.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const nextStep = () => setStep(prev => (prev < 5 ? (prev + 1) as Step : prev));
  const prevStep = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  const handleFinish = async () => {
    if (!wizardOptions) {
      toast.error(t('wizard_unavailable'));
      return;
    }

    if (!resolvedProductId || !resolvedVariant?.id || !configCode || calculatedUnitPrice <= 0) {
      toast.error(t('wizard_confirm_error'));
      return;
    }

    if (!selections.line || !selections.size || !selections.material) {
      toast.error(t('wizard_complete_configuration'));
      return;
    }

    if (isUploadingLogo) {
      toast.error('La imagen se esta cargando. Espera un momento.');
      return;
    }

    if (uploadedLogo && !selections.designUrl) {
      toast.error('La imagen personalizada no esta disponible todavia. Vuelve a subirla.');
      return;
    }

    const selectedPersonalizations = [
      ...((selections.designUrl || uploadedLogo) && selections.markingType
        ? [{ code: selections.markingType, options: [selections.markingType] }]
        : []),
      ...selections.extraOptions.map((optionCode) => ({
        code: optionCode,
        options: [optionCode],
      })),
    ];

    setIsSubmittingRequest(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push('/login?redirect=/personaliza');
        return;
      }

      const response = await apiFetch('/personalizations/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: resolvedProductId,
          variantId: resolvedVariant.id,
          line: selections.line,
          size: selections.size,
          material: selections.material,
          quantity: Number(selections.quantity),
          customImageURL: selections.designUrl || undefined,
          personalizations: selectedPersonalizations,
        }),
      });

      if (response.status === 401) {
        router.push('/login?redirect=/personaliza');
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const detail =
          typeof errorBody.message === 'string'
            ? errorBody.message
            : Array.isArray(errorBody.message)
              ? errorBody.message.join(', ')
            : 'No fue posible registrar la solicitud.';
        throw new Error(detail);
      }

      const body = await response.json();
      const requestId =
        body?.data?.id && typeof body.data.id === 'string' ? body.data.id : null;

      setSubmittedRequestId(requestId);
      toast.success('Tu solicitud fue enviada para revision de un asesor.');
    } catch (error) {
      console.error('Personalization request error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible enviar la solicitud.',
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (submittedRequestId) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-24 px-8 gap-5 shadow-xl text-center">
        <Check className="w-10 h-10 text-primary" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
          Solicitud enviada
        </p>
        <h2 className="text-3xl font-serif text-primary">
          Un asesor revisara tu personalizacion antes de finalizar la compra.
        </h2>
        <p className="text-sm text-muted max-w-2xl">
          Registramos tu configuracion con el codigo{' '}
          <span className="font-bold text-primary">{configCode}</span>.
          {submittedRequestId ? ` Solicitud: ${submittedRequestId}.` : ''}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push('/profile')}
            className="px-6 py-3 bg-primary text-base-color rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Ir a mi perfil
          </button>
          <button
            onClick={() => router.push('/catalog')}
            className="px-6 py-3 border border-theme text-primary rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Seguir explorando
          </button>
        </div>
      </div>
    );
  }

  if (loadingOptions) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-40 gap-4 shadow-xl">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted">{t('wizard_loading_experience')}</p>
      </div>
    );
  }

  if (optionsError || !wizardOptions) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-24 px-8 gap-5 shadow-xl text-center">
        <AlertCircle className="w-10 h-10 text-accent" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
          {t('wizard_unavailable_title')}
        </p>
        <p className="text-sm text-muted max-w-md">
          {optionsError || t('wizard_load_options_error')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-base-color rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const availableTechniqueOptions =
    wizardOptions.TECHNIQUE.filter(
      (option) =>
        !isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    ) || [];

  const availableOtherOptions =
    wizardOptions.TECHNIQUE.filter(
      (option) =>
        isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    ) || [];

  const noPersonalizationOptionsAvailable =
    availableTechniqueOptions.length === 0 && availableOtherOptions.length === 0;
  const estimatedPriceLabel =
    selections.quantity > 1 ? t('estimated_total') : t('estimated_price');

  return (
    <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">
      <aside className="w-full md:w-1/3 bg-primary p-8 text-base-color flex flex-col justify-between">
        <div>
          <div className="mb-10">
            <h2 className="text-2xl font-serif font-bold">{t('customization')}</h2>
            <p className="text-base-color/60 text-sm">{t('step')} {step} {t('of')} 5</p>
          </div>

          <nav className="space-y-6">
            {[
              { s: 1, label: t('production_line') },
              { s: 2, label: t('dimensions') },
              { s: 3, label: t('product_material') },
              { s: 4, label: t('customization') },
              { s: 5, label: t('final_summary') }
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
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">{estimatedPriceLabel}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${calculatedTotalPrice.toLocaleString('es-CO')}</span>
            <span className="text-[10px] opacity-60">{t('wizard_currency_unit')}</span>
          </div>
          {selections.quantity > 1 && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-base-color/70">
              ${calculatedUnitPrice.toLocaleString('es-CO')} c/u
            </p>
          )}
          {isPricingLoading && <Loader2 size={12} className="animate-spin mt-2" />}
        </div>
      </aside>

      <main className="flex-1 p-8 md:p-12 flex flex-col">
        <div className="flex-grow">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_1_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_1_description')}</p>
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

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_2_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_2_description')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {wizardOptions?.DIMENSION.map(dim => (
                  <button
                    key={dim.id}
                    onClick={() => setSelections(prev => ({ ...prev, size: dim.name }))}
                    className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${selections.size === dim.name ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                  >
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`w-16 h-20 border-2 rounded-lg transition-all ${selections.size === dim.name ? 'border-primary bg-primary/20' : 'border-muted opacity-30'}`}
                        style={{ transform: `scale(${dim.name.toLowerCase().includes('peque') ? 0.75 : dim.name.toLowerCase().includes('grand') ? 1.2 : 1})` }}
                      />
                      <span className="absolute text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                        {getDimensionVisualLabel(dim)}
                      </span>
                    </div>
                    <span className="font-black uppercase tracking-widest text-[10px]">{dim.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="space-y-4">
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_3_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_3_description')}</p>
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

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_4_title')}</h3>
                    <p className="text-muted text-sm">{t('wizard_step_4_description')}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_upload_design')}</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-theme rounded-2xl flex items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <Upload size={20} className="text-muted group-hover:text-primary" />
                      <span className="text-sm font-bold text-primary">{t('wizard_upload_image')}</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </button>
                    {isUploadingLogo && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                        <Loader2 size={14} className="animate-spin" />
                        Persistiendo imagen...
                      </div>
                    )}
                    {uploadedLogo && (
                      <div className="mt-4 p-4 bg-base/50 rounded-2xl border border-theme animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('wizard_design_size')}</label>
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
                    <p className="text-[10px] text-muted uppercase text-center">{t('wizard_recommended_background')}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_marking_technique')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableTechniqueOptions.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelections(prev => ({ ...prev, markingType: t.code }))}
                          className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${selections.markingType === t.code ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted hover:border-primary/30'}`}
                        >
                          {t.name}
                        </button>
                      ))}
                      {availableTechniqueOptions.length === 0 && (
                        <div className="col-span-2 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                          <AlertCircle className="text-red-500 shrink-0" size={16} />
                          <p className="text-[10px] font-medium text-red-700">
                            {t('wizard_not_compatible', { material: selections.material })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_other_options')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableOtherOptions.map(option => {
                        const isSelected = selections.extraOptions.includes(option.code);
                        return (
                          <button
                            key={option.id}
                            onClick={() =>
                              setSelections((prev) => ({
                                ...prev,
                                extraOptions: prev.extraOptions.includes(option.code)
                                  ? prev.extraOptions.filter((code) => code !== option.code)
                                  : [...prev.extraOptions, option.code],
                              }))
                            }
                            className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${isSelected ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted hover:border-primary/30'}`}
                          >
                            {option.name}
                          </button>
                        );
                      })}
                      {availableOtherOptions.length === 0 && !noPersonalizationOptionsAvailable && (
                        <div className="col-span-2 p-4 bg-base/50 border border-theme rounded-2xl">
                          <p className="text-[10px] font-medium text-muted">
                            {t('wizard_other_options_empty')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-sm aspect-[4/6] bg-gray-100 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
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

                    <div className="absolute top-[44%] left-[28%] w-[45%] h-[35%] border-2 border-dashed border-gray-400/50 rounded-lg flex items-center justify-center z-10 overflow-hidden">
                      {uploadedLogo ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                          <Image
                            src={uploadedLogo}
                            alt="Logo preview"
                            width={200}
                            height={200}
                            style={{ width: `${logoScale}%`, height: 'auto', objectFit: 'contain' }}
                            className="animate-in zoom-in-50 duration-300 transition-all"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-4">{t('wizard_print_area')}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest">{t('wizard_interactive_preview')}</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div>
                <h3 className="text-3xl font-serif text-primary mb-2">{t('wizard_ready_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_ready_description')}</p>
              </div>

              <div className="bg-base/50 rounded-3xl p-8 border border-theme space-y-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('production_line')}</p><p className="font-bold text-primary">{selections.line}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('dimensions')}</p><p className="font-bold text-primary">{selections.size}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('product_material')}</p><p className="font-bold text-primary">{selections.material}</p></div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('customization')}</p>
                    <p className="font-bold text-primary">
                      {[
                        wizardOptions?.TECHNIQUE.find(t => t.code === selections.markingType)?.name,
                        ...selections.extraOptions.map((optionCode) =>
                          wizardOptions?.TECHNIQUE.find((technique) => technique.code === optionCode)?.name || optionCode,
                        ),
                      ]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-theme flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="text-secondary" size={20} />
                    <div className="text-[10px] font-bold text-muted">
                      {t('wizard_estimated_delivery')} <br />
                      <span className="text-primary uppercase">{t('wizard_estimated_delivery_time')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted mb-1">{t('wizard_quantity')}</p>
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

        <div className="mt-auto flex gap-4 pt-8 border-t border-theme bg-surface sticky bottom-0 left-0 right-0 md:relative z-20 pb-4 md:pb-0">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="px-6 md:px-8 py-4 border-2 border-theme rounded-2xl text-primary font-black uppercase tracking-widest text-[10px] hover:bg-base transition-all flex items-center gap-2 bg-white"
            >
              <ChevronLeft size={16} /> <span className="hidden md:inline">{t('back')}</span>
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={nextStep}
              disabled={
                isPricingLoading ||
                 isUploadingLogo ||
                 !wizardOptions ||
                 !resolvedProductId ||
                 !resolvedVariant?.id ||
                (step === 1 && !selections.line) ||
                (step === 2 && !selections.size) ||
                (step === 3 && !selections.material) ||
                (step === 4 &&
                  (!uploadedLogo || !selections.designUrl || !configCode))
              }
              className="flex-1 px-8 py-4 bg-primary text-base-color rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {t('continue')} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSubmittingRequest}
              className="flex-1 px-8 py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 disabled:opacity-50"
            >
              {isSubmittingRequest ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando solicitud
                </>
              ) : (
                <>
                  Enviar para revision <ChevronRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
