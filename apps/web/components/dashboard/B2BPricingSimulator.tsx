'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Calculator,
  Loader2,
  Package2,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

interface ProductVariant {
  id: string;
  sku: string;
  size?: string | null;
  color: string;
  stock?: number;
  stockAvailable?: number;
  salePrice?: number | null;
  minPrice?: number | null;
  comparePrice?: number | null;
  costPrice?: number | null;
  totalCost?: number | null;
  taxRate?: number | string | null;
  imageUrl: string;
  isActive?: boolean;
}

interface ProductAttribute {
  type: 'LINE' | 'MATERIAL' | 'QUALITY' | string;
  value: string;
  isActive?: boolean;
}

interface PricingRule {
  scope: 'B2B' | 'B2C' | string;
  minQty: number;
  maxQty?: number | null;
  discountPct?: number | null;
  fixedUnitPrice?: number | null;
  isActive?: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  basePrice?: number;
  variants?: ProductVariant[] | null;
  attributes?: ProductAttribute[] | null;
  pricingRules?: PricingRule[] | null;
}

interface WizardOption {
  id?: string;
  code?: string;
  name?: string;
  value?: string;
}

interface GroupedWizardOptions {
  LINE?: WizardOption[];
  MATERIAL?: WizardOption[];
  QUALITY?: WizardOption[];
}

interface QuoteResponse {
  unitPrice: number;
  quantity: number;
  total: number;
  netTotal: number;
  netUnitPrice: number;
  taxAmount: number;
  taxRate: number;
  currency: string;
  snapshot?: {
    minPriceGuardApplied?: boolean;
    volumeDiscount?: {
      minQuantity: number;
      percentage: number;
      amount: number;
    };
    manualDiscount?: {
      requestedPercentage: number;
      requestedAmount: number;
      appliedPercentage: number;
      appliedAmount: number;
    };
  };
}

interface SimulatorFormState {
  productId: string;
  variantId: string;
  quantity: string;
  manualDiscountPct: string;
  line: string;
  material: string;
  quality: string;
}

const INITIAL_FORM: SimulatorFormState = {
  productId: '',
  variantId: '',
  quantity: '50',
  manualDiscountPct: '0',
  line: '',
  material: '',
  quality: '',
};

function formatCurrency(
  amount: number | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  if (amount === null || amount === undefined) {
    return '--';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amount);
}

function formatPreciseCurrency(amount: number | null | undefined) {
  return formatCurrency(amount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  const normalized = Number(value.toFixed(2));
  return Number.isInteger(normalized)
    ? `${normalized.toFixed(0)}%`
    : `${normalized.toFixed(2)}%`;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.message)) {
      return record.message.join(', ');
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
  }

  return fallback;
}

async function getResponseErrorMessage(
  response: Response,
  fallback: string,
) {
  const payload = await response.json().catch(() => null);
  return getErrorMessage(payload, fallback);
}

function unwrapApiData<T>(payload: ApiResponse<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return ((payload as ApiResponse<T>).data ?? null) as T;
  }

  return payload as T;
}

function toWizardValues(options?: WizardOption[] | null) {
  return (options ?? [])
    .map((option) => option.name || option.value || option.code || '')
    .filter((value): value is string => value.trim().length > 0);
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function resolveSelection(
  currentValue: string,
  options: string[],
  required: boolean,
) {
  if (options.length === 0) {
    return '';
  }

  if (currentValue && options.includes(currentValue)) {
    return currentValue;
  }

  return required ? options[0] : '';
}

export default function B2BPricingSimulator() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [options, setOptions] = useState<GroupedWizardOptions>({});
  const [loadingInputs, setLoadingInputs] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [form, setForm] = useState<SimulatorFormState>(INITIAL_FORM);
  const [priceDraft, setPriceDraft] = useState('');
  const [priceInputError, setPriceInputError] = useState<string | null>(null);
  const [discountInputError, setDiscountInputError] = useState<string | null>(null);
  const supabase = createClient();

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? null,
    [form.productId, products],
  );

  const activeVariants = useMemo(
    () => (selectedProduct?.variants ?? []).filter((variant) => variant.isActive !== false),
    [selectedProduct],
  );

  const selectedVariant = useMemo(
    () => activeVariants.find((variant) => variant.id === form.variantId) ?? null,
    [activeVariants, form.variantId],
  );

  const lineOptions = useMemo(() => {
    const productValues = uniqueValues(
      (selectedProduct?.attributes ?? [])
        .filter((attribute) => attribute.type === 'LINE' && attribute.isActive !== false)
        .map((attribute) => attribute.value),
    );

    return productValues.length > 0
      ? productValues
      : uniqueValues(toWizardValues(options.LINE));
  }, [options.LINE, selectedProduct]);

  const materialOptions = useMemo(() => {
    const productValues = uniqueValues(
      (selectedProduct?.attributes ?? [])
        .filter((attribute) => attribute.type === 'MATERIAL' && attribute.isActive !== false)
        .map((attribute) => attribute.value),
    );

    return productValues.length > 0
      ? productValues
      : uniqueValues(toWizardValues(options.MATERIAL));
  }, [options.MATERIAL, selectedProduct]);

  const qualityOptions = useMemo(() => {
    const productValues = uniqueValues(
      (selectedProduct?.attributes ?? [])
        .filter((attribute) => attribute.type === 'QUALITY' && attribute.isActive !== false)
        .map((attribute) => attribute.value),
    );

    return productValues.length > 0
      ? productValues
      : uniqueValues(toWizardValues(options.QUALITY));
  }, [options.QUALITY, selectedProduct]);

  const selectedVariantCurrentPrice =
    selectedVariant?.salePrice ?? selectedProduct?.basePrice ?? null;

  useEffect(() => {
    let active = true;

    const fetchInputs = async () => {
      const fetchProducts = async (token: string) => {
        const authHeaders = {
          Authorization: `Bearer ${token}`,
        };
        const adminResponse = await apiFetch('/catalog/admin/products', {
          headers: authHeaders,
        });

        if (adminResponse.ok) {
          const body = await adminResponse.json();
          return {
            products: unwrapApiData<ProductOption[]>(body) ?? [],
            usedPublicFallback: false,
          };
        }

        if (adminResponse.status === 401 || adminResponse.status === 403) {
          const publicResponse = await apiFetch('/catalog/products');

          if (!publicResponse.ok) {
            throw new Error(
              await getResponseErrorMessage(
                publicResponse,
                `No se pudo cargar el catalogo publico (${publicResponse.status}).`,
              ),
            );
          }

          const body = await publicResponse.json();
          return {
            products: unwrapApiData<ProductOption[]>(body) ?? [],
            usedPublicFallback: true,
          };
        }

        throw new Error(
          await getResponseErrorMessage(
            adminResponse,
            `No se pudo cargar el catalogo interno (${adminResponse.status}).`,
          ),
        );
      };

      const fetchGroupedOptions = async (token: string) => {
        const optionsResponse = await apiFetch('/wizard-options/grouped', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!optionsResponse.ok) {
          throw new Error(
            await getResponseErrorMessage(
              optionsResponse,
              `No se pudieron cargar las opciones del simulador (${optionsResponse.status}).`,
            ),
          );
        }

        const body = await optionsResponse.json();
        return unwrapApiData<GroupedWizardOptions>(body) ?? {};
      };

      try {
        setLoadingInputs(true);
        setLoadError(null);
        setLoadWarning(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error(
            'Tu sesion expiro. Inicia sesion de nuevo para usar el simulador B2B.',
          );
        }

        const [productsResult, optionsResult] = await Promise.allSettled([
          fetchProducts(token),
          fetchGroupedOptions(token),
        ]);

        if (!active) {
          return;
        }

        const warnings: string[] = [];
        const errors: string[] = [];

        if (productsResult.status === 'fulfilled') {
          setProducts(productsResult.value.products);
          if (productsResult.value.usedPublicFallback) {
            warnings.push(
              'Se cargo el catalogo publico porque tu sesion no tiene acceso al catalogo interno.',
            );
          }
        } else {
          setProducts([]);
          errors.push(
            productsResult.reason instanceof Error
              ? productsResult.reason.message
              : 'No se pudo cargar el catalogo del simulador B2B.',
          );
        }

        if (optionsResult.status === 'fulfilled') {
          setOptions(optionsResult.value);
        } else {
          setOptions({});
          warnings.push(
            optionsResult.reason instanceof Error
              ? optionsResult.reason.message
              : 'No se pudieron cargar algunas opciones del simulador.',
          );
        }

        setLoadError(errors.length > 0 ? errors.join(' ') : null);
        setLoadWarning(warnings.length > 0 ? warnings.join(' ') : null);
      } catch (error) {
        console.error('Error loading B2B pricing simulator inputs:', error);
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No se pudo cargar el simulador interno de B2B.',
          );
        }
      } finally {
        if (active) {
          setLoadingInputs(false);
        }
      }
    };

    void fetchInputs();

    return () => {
      active = false;
    };
  }, [supabase.auth]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !quoteLoading) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, quoteLoading]);

  useEffect(() => {
    if (!selectedProduct) {
      setForm((current) => ({
        ...current,
        variantId: '',
        line: '',
        material: '',
        quality: '',
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      variantId: resolveSelection(
        current.variantId,
        activeVariants.map((variant) => variant.id),
        true,
      ),
      line: resolveSelection(current.line, lineOptions, true),
      material: resolveSelection(current.material, materialOptions, true),
      quality: resolveSelection(current.quality, qualityOptions, false),
    }));
  }, [activeVariants, lineOptions, materialOptions, qualityOptions, selectedProduct]);

  useEffect(() => {
    setPriceDraft(
      selectedVariantCurrentPrice !== null && selectedVariantCurrentPrice !== undefined
        ? String(selectedVariantCurrentPrice)
        : '',
    );
    setPriceInputError(null);
  }, [selectedVariantCurrentPrice]);

  const updateForm = <K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setQuote(null);
    setQuoteError(null);
  };

  const handleCalculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const nextPrice = Number(priceDraft);
    const nextDiscount = Number(form.manualDiscountPct);

    if (!form.productId || !form.variantId || !form.line || !form.material) {
      setQuoteError('Completa producto, variante, linea y material antes de calcular.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      setQuoteError('La cantidad debe ser un numero valido.');
      return;
    }

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setPriceInputError('Ingresa un PVP valido para la simulacion.');
      return;
    }

    if (!Number.isFinite(nextDiscount) || nextDiscount < 0 || nextDiscount > 100) {
      setDiscountInputError('Ingresa un descuento valido entre 0 y 100.');
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    setPriceInputError(null);
    setDiscountInputError(null);

    try {
      const response = await apiFetch('/pricing/quote?scope=B2B', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: form.productId,
          variantId: form.variantId,
          quantity,
          line: form.line,
          material: form.material,
          quality: form.quality || undefined,
          size: selectedVariant?.size || undefined,
          simulatedPvp: nextPrice,
          manualDiscountPct: nextDiscount,
          ignoreMinPriceGuard: true,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `No se pudo calcular la cotizacion (${response.status}).`),
        );
      }

      setQuote(unwrapApiData<QuoteResponse>(body as QuoteResponse));
    } catch (error) {
      console.error('Error calculating B2B quote:', error);
      setQuoteError(
        error instanceof Error
          ? error.message
          : 'No se pudo calcular la cotizacion B2B.',
      );
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all hover:shadow-xl hover:shadow-primary/20 active:scale-95"
      >
        <Calculator className="h-4 w-4" />
        Simular PVP
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!quoteLoading) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="b2b-pricing-simulator-title"
            className="w-full max-w-6xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-theme bg-base/40 px-6 py-5 md:px-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  Herramienta interna
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      id="b2b-pricing-simulator-title"
                      className="text-2xl font-black tracking-tight text-primary"
                    >
                      Simulador de PVP B2B
                    </h2>
                    <p className="text-sm font-medium text-muted">
                      Estima cuanto cobrar por cantidad con un PVP temporal para la variante seleccionada.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={quoteLoading}
                className="rounded-full bg-base/80 p-2 text-muted transition-all hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cerrar simulador de precios B2B"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[calc(100vh-10rem)] grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6 border-b border-theme px-6 py-6 lg:border-b-0 lg:border-r lg:px-8">
                <div className="rounded-2xl border border-theme bg-base/40 p-4">
                  <p className="text-xs font-bold leading-relaxed text-muted">
                    El calculo usa el endpoint de pricing con alcance <span className="font-black text-primary">B2B</span>.
                    El PVP que ingreses aqui solo se usa para esta simulacion y no modifica el catalogo ni aplica piso minimo comercial.
                  </p>
                </div>

                {loadError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {loadError}
                  </div>
                ) : null}

                {loadWarning ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    {loadWarning}
                  </div>
                ) : null}

                <form className="space-y-5" onSubmit={handleCalculate}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Producto base
                      </label>
                      <select
                        value={form.productId}
                        onChange={(event) => updateForm('productId', event.target.value)}
                        disabled={loadingInputs}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Selecciona un producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Variante
                      </label>
                      <select
                        value={form.variantId}
                        onChange={(event) => updateForm('variantId', event.target.value)}
                        disabled={loadingInputs || !selectedProduct}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Selecciona una variante</option>
                        {activeVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.size || 'Sin talla'} | {variant.color} | {variant.sku}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.quantity}
                        onChange={(event) => updateForm('quantity', event.target.value)}
                        disabled={loadingInputs}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Linea
                      </label>
                      <select
                        value={form.line}
                        onChange={(event) => updateForm('line', event.target.value)}
                        disabled={loadingInputs || lineOptions.length === 0}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Selecciona una linea</option>
                        {lineOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Material
                      </label>
                      <select
                        value={form.material}
                        onChange={(event) => updateForm('material', event.target.value)}
                        disabled={loadingInputs || materialOptions.length === 0}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Selecciona un material</option>
                        {materialOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                        Calidad
                      </label>
                      <select
                        value={form.quality}
                        onChange={(event) => updateForm('quality', event.target.value)}
                        disabled={loadingInputs}
                        className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Sin calidad especifica</option>
                        {qualityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {quoteError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {quoteError}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs font-medium text-muted">
                      Usa una variante real para respetar precio base y reglas por volumen.
                    </p>
                    <button
                      type="submit"
                      disabled={loadingInputs || quoteLoading || Boolean(loadError)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {quoteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Calculator className="h-4 w-4" />
                      )}
                      Calcular cuanto cobrar
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-5 px-6 py-6 lg:px-8">
                <div className="rounded-2xl border border-theme bg-base/40 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Package2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                      Referencia seleccionada
                    </h3>
                  </div>

                  {selectedProduct ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-black tracking-tight text-primary">
                          {selectedProduct.name}
                        </p>
                        <p className="text-xs font-medium text-muted">
                          {selectedVariant
                            ? `${selectedVariant.size || 'Sin talla'} | ${selectedVariant.color}`
                            : 'Selecciona una variante activa para calcular.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-theme bg-surface px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            PVP para simular
                          </p>
                          <div className="mt-2 space-y-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={priceDraft}
                              onChange={(event) => {
                                setPriceDraft(event.target.value);
                                setPriceInputError(null);
                                setQuote(null);
                                setQuoteError(null);
                              }}
                              disabled={!selectedVariant}
                              className="w-full rounded-xl border border-theme bg-base px-3 py-2 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p className="text-[10px] font-semibold text-muted">
                              {selectedVariantCurrentPrice !== null
                                ? `Referencia actual: ${formatCurrency(selectedVariantCurrentPrice)}`
                                : 'Selecciona una variante activa'}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-theme bg-surface px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            Descuento %
                          </p>
                          <div className="mt-2 space-y-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={form.manualDiscountPct}
                              onChange={(event) => {
                                updateForm('manualDiscountPct', event.target.value);
                                setDiscountInputError(null);
                              }}
                              disabled={!selectedVariant}
                              className="w-full rounded-xl border border-theme bg-base px-3 py-2 text-sm font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p className="text-[10px] font-semibold text-muted">
                              Se aplica al valor calculado de la cotizacion sin forzar piso minimo.
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-theme bg-surface px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            Disponible
                          </p>
                          <p className="mt-1 text-sm font-black text-primary">
                            {selectedVariant?.stockAvailable ?? selectedVariant?.stock ?? 0} und
                          </p>
                        </div>
                      </div>

                      {priceInputError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                          {priceInputError}
                        </div>
                      ) : null}

                      {discountInputError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                          {discountInputError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-muted">
                      Elige un producto para ver su referencia comercial y calcular el valor sugerido.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                      Resultado sugerido
                    </h3>
                  </div>

                  {quote ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-primary px-4 py-4 text-base-color shadow-lg shadow-primary/10">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-base-color/80">
                            Precio unitario
                          </p>
                          <p className="mt-2 text-2xl font-black">
                            {formatPreciseCurrency(quote.unitPrice)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-theme bg-base px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                            Total a cobrar
                          </p>
                          <p className="mt-2 text-2xl font-black text-primary">
                            {formatPreciseCurrency(quote.total)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0 rounded-xl border border-theme bg-base px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            Neto unitario
                          </p>
                          <p className="mt-1 text-[15px] font-black leading-tight text-primary sm:text-base">
                            {formatPreciseCurrency(quote.netUnitPrice)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-xl border border-theme bg-base px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            Total sin IVA
                          </p>
                          <p className="mt-1 text-[15px] font-black leading-tight text-primary sm:text-base">
                            {formatPreciseCurrency(quote.netTotal)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-xl border border-theme bg-base px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            IVA total
                          </p>
                          <p className="mt-1 text-[15px] font-black leading-tight text-primary sm:text-base">
                            {formatPreciseCurrency(quote.taxAmount)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-xl border border-theme bg-base px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                            Tasa IVA
                          </p>
                          <p className="mt-1 text-[15px] font-black leading-tight text-primary sm:text-base">
                            {(quote.taxRate * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {quote.snapshot?.volumeDiscount ? (
                          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              Se aplico una regla B2B desde {quote.snapshot.volumeDiscount.minQuantity} unidades.
                            </span>
                          </div>
                        ) : null}

                        {quote.snapshot?.manualDiscount ? (
                          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              Se aplico un descuento manual de {formatPercentage(quote.snapshot.manualDiscount.appliedPercentage)} por unidad.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-muted">
                      Completa la referencia y pulsa <span className="font-black text-primary">Calcular cuanto cobrar</span> para obtener el precio sugerido por unidad y el total del pedido.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
