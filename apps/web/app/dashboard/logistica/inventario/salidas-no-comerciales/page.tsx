'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Boxes,
  Gift,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Select } from '@tote-bag/ui';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { Combobox } from '@/components/ui/Combobox';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

type NonCommercialOutputReason =
  | 'GIFT'
  | 'SAMPLE'
  | 'INTERNAL_TEST'
  | 'OPERATIONAL_USE'
  | 'OTHER';

type NonCommercialOutputStatus = 'COMPLETED';

interface ReceivableVariant {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  stock?: number | null;
  stockPhysical?: number | null;
  stockCommitted?: number | null;
  stockAvailable?: number | null;
  productId: string;
}

interface ReceivableProduct {
  id: string;
  name: string;
  variants?: ReceivableVariant[];
}

interface VariantOption {
  id: string;
  label: string;
  productName: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  stockAvailable: number;
  stockPhysical: number;
  stockCommitted: number;
}

interface NonCommercialOutput {
  id: string;
  quantity: number;
  reason: NonCommercialOutputReason;
  notes?: string | null;
  supportUrl?: string | null;
  status: NonCommercialOutputStatus;
  createdAt: string;
  stockBefore?: number | null;
  stockAfter?: number | null;
  variant?: {
    id: string;
    sku?: string | null;
    size?: string | null;
    color?: string | null;
    product?: {
      id: string;
      name?: string | null;
      slug?: string | null;
    } | null;
  } | null;
  user?: {
    id: string;
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
}

interface FormState {
  variantId: string;
  quantity: string;
  reason: NonCommercialOutputReason;
  notes: string;
  supportUrl: string;
}

const REASON_LABELS: Record<NonCommercialOutputReason, string> = {
  GIFT: 'Regalo',
  SAMPLE: 'Muestra',
  INTERNAL_TEST: 'Prueba interna',
  OPERATIONAL_USE: 'Uso operativo',
  OTHER: 'Otro',
};

const STATUS_LABELS: Record<NonCommercialOutputStatus, string> = {
  COMPLETED: 'Registrada',
};

const REASON_BADGE_STYLES: Record<NonCommercialOutputReason, string> = {
  GIFT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SAMPLE: 'border-sky-200 bg-sky-50 text-sky-700',
  INTERNAL_TEST: 'border-amber-200 bg-amber-50 text-amber-700',
  OPERATIONAL_USE: 'border-violet-200 bg-violet-50 text-violet-700',
  OTHER: 'border-slate-200 bg-slate-50 text-slate-700',
};

const STATUS_BADGE_STYLES: Record<NonCommercialOutputStatus, string> = {
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const DEFAULT_FORM: FormState = {
  variantId: '',
  quantity: '',
  reason: 'GIFT',
  notes: '',
  supportUrl: '',
};

function formatUnits(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

function truncateText(value?: string | null, limit = 70) {
  const normalized = value?.trim();

  if (!normalized) {
    return 'Sin observacion';
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getApiList<T>(body: unknown): T[] {
  if (Array.isArray(body)) {
    return body as T[];
  }

  if (isRecord(body) && Array.isArray(body.data)) {
    return body.data as T[];
  }

  return [];
}

function formatVariantLabel(productName: string, variant: ReceivableVariant) {
  const details = [variant.size, variant.color].filter(Boolean).join(' / ');
  return `${productName}${details ? ` - ${details}` : ''} (${variant.sku})`;
}

function resolveUserLabel(output: NonCommercialOutput) {
  const firstName = output.user?.profile?.firstName?.trim();
  const lastName = output.user?.profile?.lastName?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  if (fullName) {
    return fullName;
  }

  const email = output.user?.email?.trim();

  if (!email) {
    return 'Usuario no disponible';
  }

  return email.split('@')[0] || email;
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </p>
      <h2 className="mt-1 text-2xl font-black text-primary">{value}</h2>
      <p className="mt-2 text-xs font-medium text-muted">{detail}</p>
    </div>
  );
}

export default function NonCommercialOutputsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { accessToken } = useDashboardAuth();

  const [products, setProducts] = useState<ReceivableProduct[]>([]);
  const [outputs, setOutputs] = useState<NonCommercialOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const variantOptions = useMemo<VariantOption[]>(
    () =>
      products.flatMap((product) =>
        (product.variants || []).map((variant) => ({
          id: variant.id,
          label: formatVariantLabel(product.name, variant),
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stockAvailable: Number(variant.stockAvailable ?? 0),
          stockPhysical: Number(variant.stockPhysical ?? variant.stock ?? 0),
          stockCommitted: Number(variant.stockCommitted ?? 0),
        })),
      ),
    [products],
  );

  const selectedVariant = useMemo(
    () => variantOptions.find((variant) => variant.id === form.variantId) ?? null,
    [form.variantId, variantOptions],
  );

  const requestedQuantity = Number.parseInt(form.quantity, 10);
  const hasValidQuantity = Number.isInteger(requestedQuantity) && requestedQuantity > 0;
  const stockValidationMessage =
    selectedVariant && hasValidQuantity && requestedQuantity > selectedVariant.stockAvailable
      ? `Solo hay ${formatUnits(selectedVariant.stockAvailable)} unidades disponibles para esta variante.`
      : null;

  const summary = useMemo(
    () => ({
      totalRecords: outputs.length,
      totalUnits: outputs.reduce(
        (sum, output) => sum + Number(output.quantity || 0),
        0,
      ),
      activeReasons: new Set(outputs.map((output) => output.reason)).size,
      lastMovementAt: outputs[0]?.createdAt ?? null,
    }),
    [outputs],
  );

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? accessToken;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [accessToken, supabase.auth]);

  const resolveApiErrorMessage = useCallback(
    async (
      response: Response,
      fallbackMessage: string,
      options?: { redirectOnUnauthorized?: boolean; forbiddenMessage?: string },
    ) => {
      if (response.status === 401) {
        if (options?.redirectOnUnauthorized) {
          router.push(
            `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
          );
        }

        return 'Tu sesion expiro. Inicia sesion nuevamente.';
      }

      if (response.status === 403) {
        return (
          options?.forbiddenMessage ||
          'No tienes permisos para gestionar salidas no comerciales.'
        );
      }

      const body: unknown = await response.json().catch(() => null);

      if (isRecord(body)) {
        const message = body.message;

        if (typeof message === 'string' && message.trim()) {
          return message;
        }

        if (Array.isArray(message)) {
          const firstMessage = message.find(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          );

          if (firstMessage) {
            return firstMessage;
          }
        }

        if (typeof body.error === 'string' && body.error.trim()) {
          return body.error;
        }
      }

      return fallbackMessage;
    },
    [router],
  );

  const fetchModuleData = useCallback(
    async (options?: { background?: boolean }) => {
      if (options?.background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const authHeaders = await getAuthHeaders();
        const [variantsRes, outputsRes] = await Promise.all([
          apiFetch('/inventory/receivable-variants', {
            headers: authHeaders,
          }),
          apiFetch('/inventory/non-commercial-outputs', {
            headers: authHeaders,
          }),
        ]);

        if (!variantsRes.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              variantsRes,
              'No fue posible cargar las variantes del catalogo.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        if (!outputsRes.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              outputsRes,
              'No fue posible cargar el historial de salidas no comerciales.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        const [variantsBody, outputsBody] = await Promise.all([
          variantsRes.json() as Promise<unknown>,
          outputsRes.json() as Promise<unknown>,
        ]);

        setProducts(getApiList<ReceivableProduct>(variantsBody));
        setOutputs(getApiList<NonCommercialOutput>(outputsBody));
      } catch (fetchError) {
        console.error('Error loading non-commercial outputs module:', fetchError);
        setProducts([]);
        setOutputs([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'No fue posible cargar el modulo de salidas no comerciales.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAuthHeaders, resolveApiErrorMessage],
  );

  useEffect(() => {
    void fetchModuleData();
  }, [fetchModuleData]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (!selectedVariant) {
        const message = 'Selecciona una variante para registrar la salida.';
        setError(message);
        toast.error(message);
        return;
      }

      if (!hasValidQuantity) {
        const message = 'La cantidad debe ser un entero mayor a cero.';
        setError(message);
        toast.error(message);
        return;
      }

      if (stockValidationMessage) {
        setError(stockValidationMessage);
        toast.error(stockValidationMessage);
        return;
      }

      setSubmitting(true);

      try {
        const authHeaders = await getAuthHeaders();
        const response = await apiFetch('/inventory/non-commercial-outputs', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variantId: form.variantId,
            quantity: requestedQuantity,
            reason: form.reason,
            notes: form.notes.trim() || undefined,
            supportUrl: form.supportUrl.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              response,
              'No fue posible registrar la salida no comercial.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        setForm(DEFAULT_FORM);
        setIsCreateModalOpen(false);
        toast.success(
          `Salida no comercial registrada para ${selectedVariant.productName}.`,
        );
        await fetchModuleData({ background: true });
      } catch (submitError) {
        console.error('Error creating non-commercial output:', submitError);
        const message =
          submitError instanceof Error
            ? submitError.message
            : 'No fue posible registrar la salida no comercial.';
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      fetchModuleData,
      form.notes,
      form.reason,
      form.supportUrl,
      form.variantId,
      getAuthHeaders,
      hasValidQuantity,
      requestedQuantity,
      resolveApiErrorMessage,
      selectedVariant,
      stockValidationMessage,
    ],
  );

  const closeCreateModal = useCallback(() => {
    if (submitting) {
      return;
    }

    setIsCreateModalOpen(false);
    setForm(DEFAULT_FORM);
    setError(null);
  }, [submitting]);

  useEffect(() => {
    if (!isCreateModalOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCreateModal();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeCreateModal, isCreateModalOpen]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted">
            Cargando salidas no comerciales...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Operacion interna con trazabilidad
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 text-base-color shadow-lg shadow-primary/20">
              <Gift className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-primary">
                Salidas no comerciales
              </h1>
              <p className="mt-1 max-w-2xl font-medium text-muted">
                Registra descuentos de inventario por regalos, muestras, pruebas
                internas y usos operativos sin crear ventas ni ingresos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setIsCreateModalOpen(true);
            }}
            disabled={refreshing || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-base-color disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Registrar nueva salida
          </Button>
          <Button
            type="button"
            onClick={() => void fetchModuleData({ background: true })}
            disabled={refreshing || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-theme bg-surface px-5 py-3 text-sm font-bold text-primary disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizar datos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <SummaryCard
          label="Registros"
          value={formatUnits(summary.totalRecords)}
          detail="Eventos administrativos ya trazados en inventario."
          icon={<Gift className="h-5 w-5" />}
        />
        <SummaryCard
          label="Unidades descontadas"
          value={formatUnits(summary.totalUnits)}
          detail="Cantidad total restada por salidas no comerciales."
          icon={<Boxes className="h-5 w-5" />}
        />
        <SummaryCard
          label="Motivos usados"
          value={formatUnits(summary.activeReasons)}
          detail="Cantidad de motivos distintos usados en el historial."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <SummaryCard
          label="Ultimo registro"
          value={summary.lastMovementAt ? formatDate(summary.lastMovementAt) : 'Sin datos'}
          detail="Fecha y hora del ultimo movimiento no comercial."
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8">
        <section className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
          <div className="flex flex-col gap-4 border-b border-theme bg-base/20 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-primary">
                Historial de salidas registradas
              </h2>
              <p className="mt-1 text-sm font-medium text-muted">
                Trazabilidad completa de descuentos no comerciales sobre stock
                real.
              </p>
            </div>
            {refreshing ? (
              <div className="inline-flex items-center gap-2 text-sm font-bold text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando...
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/30 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Producto / Variante</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Observacion</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {outputs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-14">
                      <div className="rounded-2xl border border-dashed border-theme bg-base/20 px-6 py-10 text-center text-sm italic text-muted">
                        Aun no hay salidas no comerciales registradas.
                      </div>
                    </td>
                  </tr>
                ) : (
                  outputs.map((output) => {
                    const variantDetails = [
                      output.variant?.size,
                      output.variant?.color,
                    ]
                      .filter(Boolean)
                      .join(' / ');

                    return (
                      <tr
                        key={output.id}
                        className="text-sm transition-colors hover:bg-primary/5"
                      >
                        <td className="px-6 py-5 font-medium text-muted">
                          {formatDate(output.createdAt)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-black text-primary">
                            {output.variant?.product?.name || 'Variante eliminada'}
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-muted">
                            {variantDetails ? `${variantDetails} | ` : ''}
                            {output.variant?.sku || 'SKU no disponible'}
                          </p>
                        </td>
                        <td className="px-6 py-5 font-black text-primary">
                          {formatUnits(output.quantity)}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${REASON_BADGE_STYLES[output.reason]}`}
                          >
                            {REASON_LABELS[output.reason]}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-medium text-muted">
                          {resolveUserLabel(output)}
                        </td>
                        <td className="px-6 py-5 text-sm text-muted">
                          {truncateText(output.notes)}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_BADGE_STYLES[output.status]}`}
                          >
                            {STATUS_LABELS[output.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary/20 p-4 backdrop-blur-sm"
          onClick={closeCreateModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="non-commercial-output-modal-title"
            className="my-8 w-full max-w-2xl rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-theme p-8">
              <div>
                <h2
                  id="non-commercial-output-modal-title"
                  className="text-2xl font-black text-primary"
                >
                  Registrar nueva salida
                </h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  El stock visible se toma del backend y se vuelve a consultar
                  al finalizar cada registro.
                </p>
              </div>
              <Button
                type="button"
                onClick={closeCreateModal}
                disabled={submitting}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-8">
              <div>
                <label className="mb-2 block text-sm font-bold text-primary">
                  Variante o producto
                </label>
                <Combobox
                  options={variantOptions.map((variant) => ({
                    value: variant.id,
                    label: variant.label,
                  }))}
                  value={form.variantId}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, variantId: value }))
                  }
                  placeholder="Selecciona una variante"
                  searchPlaceholder="Buscar por producto, detalle o SKU..."
                  emptyMessage="No se encontraron variantes activas."
                  disabled={submitting}
                />
              </div>

              <div className="rounded-2xl border border-theme bg-base/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Stock actual reportado por backend
                </p>
                {selectedVariant ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-black text-primary">
                        {selectedVariant.productName}
                      </p>
                      <p className="text-xs font-medium text-muted">
                        {selectedVariant.label}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-theme bg-surface p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                          Disponible
                        </p>
                        <p className="mt-1 text-lg font-black text-primary">
                          {formatUnits(selectedVariant.stockAvailable)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-theme bg-surface p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                          Fisico
                        </p>
                        <p className="mt-1 text-lg font-black text-primary">
                          {formatUnits(selectedVariant.stockPhysical)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-theme bg-surface p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                          Comprometido
                        </p>
                        <p className="mt-1 text-lg font-black text-primary">
                          {formatUnits(selectedVariant.stockCommitted)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-medium text-muted">
                    Selecciona una variante para ver su disponibilidad.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold text-primary">
                    Cantidad
                  </span>
                  <Input
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity: sanitizeIntegerInput(event.target.value),
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Ej. 5"
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-bold text-primary">
                    Motivo
                  </span>
                  <Select
                    value={form.reason}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value as NonCommercialOutputReason,
                      }))
                    }
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    {(
                      Object.entries(REASON_LABELS) as Array<
                        [NonCommercialOutputReason, string]
                      >
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              {stockValidationMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  {stockValidationMessage}
                </div>
              ) : selectedVariant ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Puedes registrar hasta{' '}
                  {formatUnits(selectedVariant.stockAvailable)} unidades
                  disponibles para esta variante.
                </div>
              ) : null}

              <label>
                <span className="mb-2 block text-sm font-bold text-primary">
                  Observacion
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  rows={4}
                  placeholder="Ej. Entrega de muestra para fotos internas o obsequio institucional."
                  className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-bold text-primary">
                  Soporte opcional
                </span>
                <Input
                  value={form.supportUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supportUrl: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  placeholder="URL o storage ref si existe soporte documental"
                  className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
                <p className="mt-2 text-xs font-medium text-muted">
                  Se deja listo para adjuntar evidencia cuando el soporte
                  exista.
                </p>
              </label>

              <div className="flex flex-col gap-3 border-t border-theme pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  onClick={() => setForm(DEFAULT_FORM)}
                  disabled={submitting}
                  className="rounded-xl border border-theme bg-base px-5 py-3 text-sm font-bold text-muted disabled:opacity-60"
                >
                  Limpiar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedVariant ||
                    !hasValidQuantity ||
                    Boolean(stockValidationMessage)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-base-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Gift className="h-4 w-4" />
                  )}
                  Registrar salida no comercial
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
