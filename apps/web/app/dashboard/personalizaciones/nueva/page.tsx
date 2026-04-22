'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Search, Sparkles, Upload } from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

interface Profile {
  id: string;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
}

interface ProductVariant {
  id: string;
  sku: string;
  size?: string | null;
  color: string;
  stock: number;
  isActive?: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  variants?: ProductVariant[] | null;
}

interface WizardOption {
  id: string;
  code: string;
  name: string;
}

interface GroupedWizardOptions {
  LINE?: WizardOption[];
  MATERIAL?: WizardOption[];
}

interface CreatedRequest {
  id: string;
  configCode?: string | null;
}

interface EditableRequestPayload extends CreatedRequest {
  profileId?: string | null;
  productId: string;
  variantId?: string | null;
  quantity: number;
  line: string;
  size?: string | null;
  material: string;
  quality?: string | null;
  notes?: string | null;
  designUrl?: string | null;
  profile?: Profile | null;
}

type FormState = {
  quantity: string;
  line: string;
  material: string;
  quality: string;
  size: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  quantity: '1',
  line: '',
  material: '',
  quality: '',
  size: '',
  notes: '',
};

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

function extractApiData<T>(payload: unknown): T | null {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return ((payload as ApiResponse<T>).data ?? null) as T | null;
  }

  return (payload as T | null) ?? null;
}

export default function NewManualPersonalizationRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const requestId = searchParams.get('editar')?.trim() || '';
  const isEditMode = requestId.length > 0;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [lineOptions, setLineOptions] = useState<WizardOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<WizardOption[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searchProfile, setSearchProfile] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [existingDesignUrl, setExistingDesignUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [createdRequest, setCreatedRequest] = useState<CreatedRequest | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push('/login');
        return;
      }

      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [profilesRes, productsRes, optionsRes, requestRes] = await Promise.all([
        apiFetch('/profiles?role=CUSTOMER', {
          headers: authHeaders,
        }),
        apiFetch('/catalog/admin/products', {
          headers: authHeaders,
        }),
        apiFetch('/wizard-options/grouped'),
        isEditMode
          ? apiFetch(`/personalizations/requests/${requestId}`, {
              headers: authHeaders,
            })
          : Promise.resolve(null),
      ]);

      if (
        !profilesRes.ok ||
        !productsRes.ok ||
        !optionsRes.ok ||
        (requestRes && !requestRes.ok)
      ) {
        const errors = [
          !profilesRes.ok ? `profiles:${profilesRes.status}` : null,
          !productsRes.ok ? `products:${productsRes.status}` : null,
          !optionsRes.ok ? `wizard-options:${optionsRes.status}` : null,
          requestRes && !requestRes.ok ? `request:${requestRes.status}` : null,
        ].filter(Boolean);

        throw new Error(`No se pudo cargar la informacion del formulario. ${errors.join(' | ')}`);
      }

      const [profilesJson, productsJson, optionsJson, requestJson]: [
        ApiResponse<Profile[]>,
        ApiResponse<ProductOption[]>,
        ApiResponse<GroupedWizardOptions>,
        unknown,
      ] = await Promise.all([
        profilesRes.json(),
        productsRes.json(),
        optionsRes.json(),
        requestRes ? requestRes.json().catch(() => null) : Promise.resolve(null),
      ]);

      const nextProfiles = profilesJson.data ?? [];
      const nextProducts = productsJson.data ?? [];
      const nextLineOptions = optionsJson.data?.LINE ?? [];
      const nextMaterialOptions = optionsJson.data?.MATERIAL ?? [];

      setProfiles(nextProfiles);
      setProducts(nextProducts);
      setLineOptions(nextLineOptions);
      setMaterialOptions(nextMaterialOptions);

      const editableRequest = isEditMode
        ? extractApiData<EditableRequestPayload>(requestJson)
        : null;

      if (isEditMode) {
        if (!editableRequest) {
          throw new Error('No se encontro la solicitud que intentas editar.');
        }

        const matchedProfile =
          nextProfiles.find((profile) => profile.id === editableRequest.profileId) ||
          (editableRequest.profile
            ? {
                id: editableRequest.profile.id,
                firstName: editableRequest.profile.firstName ?? null,
                lastName: editableRequest.profile.lastName ?? null,
                email: editableRequest.profile.email,
                phone: editableRequest.profile.phone ?? null,
              }
            : null);

        setSelectedProfile(matchedProfile);
        setSelectedProductId(editableRequest.productId);
        setSelectedVariantId(editableRequest.variantId ?? '');
        setExistingDesignUrl(editableRequest.designUrl ?? null);
        setForm({
          quantity: String(editableRequest.quantity ?? 1),
          line: editableRequest.line || nextLineOptions[0]?.code || '',
          material: editableRequest.material || nextMaterialOptions[0]?.name || '',
          quality: editableRequest.quality || '',
          size: editableRequest.size || '',
          notes: editableRequest.notes || '',
        });
      } else {
        setSelectedProfile(null);
        setSelectedProductId('');
        setSelectedVariantId('');
        setExistingDesignUrl(null);
        setForm({
          ...INITIAL_FORM,
          line: nextLineOptions[0]?.code || '',
          material: nextMaterialOptions[0]?.name || '',
        });
      }
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la informacion necesaria para crear la solicitud.',
      );
    } finally {
      setLoading(false);
    }
  }, [isEditMode, requestId, router, supabase.auth]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredProfiles = useMemo(() => {
    const term = searchProfile.trim().toLowerCase();
    if (term.length <= 2) return [];

    return profiles.filter((profile) => {
      const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim().toLowerCase();
      return profile.email.toLowerCase().includes(term) || fullName.includes(term);
    });
  }, [profiles, searchProfile]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const selectedVariant = useMemo(
    () => selectedProduct?.variants?.find((variant) => variant.id === selectedVariantId) || null,
    [selectedProduct, selectedVariantId],
  );

  const activeVariants = useMemo(
    () => (selectedProduct?.variants ?? []).filter((variant) => variant.isActive !== false),
    [selectedProduct],
  );

  const uploadDesignFile = useCallback(
    async (token: string) => {
      if (!designFile) return null;

      const body = new FormData();
      body.append('file', designFile);

      const response = await apiFetch('/personalizations/upload-design', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, `No se pudo subir el diseno (${response.status}).`),
        );
      }

      const parsed = payload as ApiResponse<{ url?: string }> | null;
      return parsed?.data?.url ?? null;
    },
    [designFile],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const quantity = Number(form.quantity);

    if (!selectedProfile) {
      setFormError('Selecciona un cliente.');
      return;
    }

    if (!selectedProductId || !selectedVariantId) {
      setFormError('Selecciona un producto y una variante comercial.');
      return;
    }

    if (!form.line || !form.material) {
      setFormError('Completa la linea y el material.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      setFormError('La cantidad debe ser mayor o igual a 1.');
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('La sesion expiro. Inicia sesion de nuevo.');
      }

      const uploadedDesignUrl = await uploadDesignFile(session.access_token);
      const designUrl = uploadedDesignUrl ?? existingDesignUrl ?? undefined;
      const endpoint = isEditMode
        ? `/personalizations/requests/${requestId}`
        : '/personalizations/requests';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          productId: selectedProductId,
          variantId: selectedVariantId,
          line: form.line,
          size: form.size.trim() || selectedVariant?.size || undefined,
          material: form.material,
          quality: form.quality.trim() || undefined,
          quantity,
          customImageURL: designUrl,
          notes: form.notes.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            `No se pudo ${isEditMode ? 'actualizar' : 'crear'} la solicitud (${response.status}).`,
          ),
        );
      }

      const savedRequest = extractApiData<CreatedRequest>(payload);
      setCreatedRequest(savedRequest);
      setExistingDesignUrl(designUrl ?? null);
      setDesignFile(null);
      if (!isEditMode) {
        setForm(INITIAL_FORM);
      }
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : `No se pudo ${isEditMode ? 'actualizar' : 'crear'} la solicitud manual.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          Cargando formulario...
        </p>
      </div>
    );
  }

  if (createdRequest) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 p-8 text-center md:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-primary">
            {isEditMode ? 'Solicitud actualizada' : 'Solicitud creada'}
          </h1>
          <p className="mt-2 text-muted">
            La solicitud manual {isEditMode ? 'quedo actualizada' : 'quedo registrada'} con el codigo{' '}
            <span className="font-black text-primary">{createdRequest.configCode || createdRequest.id}</span>.
          </p>
        </div>
        <div className="grid gap-3">
          <Link
            href="/dashboard/personalizaciones"
            className="rounded-2xl bg-primary p-4 font-black uppercase tracking-widest text-base-color"
          >
            Volver a personalizaciones
          </Link>
          {!isEditMode ? (
            <button
              type="button"
              onClick={() => {
                setCreatedRequest(null);
                setSelectedProfile(null);
                setSelectedProductId('');
                setSelectedVariantId('');
                setExistingDesignUrl(null);
                setForm({
                  ...INITIAL_FORM,
                  line: lineOptions[0]?.code || '',
                  material: materialOptions[0]?.name || '',
                });
              }}
              className="rounded-2xl border border-theme p-4 font-black uppercase tracking-widest text-primary"
            >
              Crear otra solicitud
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8 md:p-12">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-theme bg-surface p-2"
        >
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary">
            {isEditMode ? 'Editar solicitud manual' : 'Nueva solicitud manual'}
          </h1>
          <p className="text-sm font-medium text-muted">
            {isEditMode
              ? 'Actualiza la configuracion de la solicitud antes de continuar con la revision.'
              : 'Crea una solicitud de personalizacion para un cliente existente desde el dashboard.'}
          </p>
        </div>
      </div>

      {formError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Cliente</h2>
            {selectedProfile ? (
              <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <div>
                  <p className="font-bold text-primary">
                    {selectedProfile.firstName || 'Sin nombre'} {selectedProfile.lastName || ''}
                  </p>
                  <p className="text-xs text-muted">{selectedProfile.email}</p>
                  <p className="text-xs text-muted">{selectedProfile.phone || 'Sin telefono'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="rounded-lg border border-theme px-3 py-2 text-xs font-black uppercase tracking-widest text-primary"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={searchProfile}
                    onChange={(event) => setSearchProfile(event.target.value)}
                    placeholder="Buscar cliente por nombre o email..."
                    className="w-full rounded-2xl border border-theme bg-base py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {filteredProfiles.length > 0 ? (
                    <div className="absolute z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-theme bg-surface shadow-xl">
                      {filteredProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => {
                            setSelectedProfile(profile);
                            setSearchProfile('');
                          }}
                          className="flex w-full items-center justify-between border-b border-theme px-4 py-3 text-left hover:bg-primary/5 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-bold text-primary">
                              {profile.firstName || 'Sin nombre'} {profile.lastName || ''}
                            </p>
                            <p className="text-[10px] text-muted">{profile.email}</p>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Seleccionar
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Escribe minimo 3 caracteres para buscar.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Producto base</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={selectedProductId}
                onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  setSelectedVariantId('');
                  setForm((current) => ({ ...current, size: '' }));
                }}
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
                required
              >
                <option value="">Selecciona producto...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedVariantId}
                onChange={(event) => {
                  const nextVariantId = event.target.value;
                  const nextVariant = activeVariants.find((variant) => variant.id === nextVariantId);
                  setSelectedVariantId(nextVariantId);
                  setForm((current) => ({
                    ...current,
                    size: nextVariant?.size || current.size,
                  }));
                }}
                disabled={!selectedProduct}
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                required
              >
                <option value="">Selecciona variante...</option>
                {activeVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {[variant.size, variant.color, variant.sku].filter(Boolean).join(' | ')} | Stock {variant.stock}
                  </option>
                ))}
              </select>
            </div>
            {selectedVariant ? (
              <div className="rounded-2xl border border-theme bg-base/50 px-4 py-3 text-sm text-muted">
                Variante seleccionada: <span className="font-bold text-primary">{selectedVariant.sku}</span>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Configuracion</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={form.line}
                onChange={(event) => setForm((current) => ({ ...current, line: event.target.value }))}
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
                required
              >
                <option value="">Linea...</option>
                {lineOptions.map((option) => (
                  <option key={option.id} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
              <select
                value={form.material}
                onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))}
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
                required
              >
                <option value="">Material...</option>
                {materialOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="Cantidad"
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <input
                value={form.size}
                onChange={(event) => setForm((current) => ({ ...current, size: event.target.value }))}
                placeholder="Tamano o referencia visual"
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                value={form.quality}
                onChange={(event) => setForm((current) => ({ ...current, quality: event.target.value }))}
                placeholder="Calidad (opcional)"
                className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20 md:col-span-2"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-theme bg-base/40 px-4 py-3 text-sm font-medium text-primary transition-all hover:border-primary/40 hover:bg-primary/5">
              <span className="flex items-center gap-3">
                <Upload className="h-4 w-4" />
                {designFile
                  ? designFile.name
                  : existingDesignUrl
                    ? 'Diseno actual cargado'
                    : 'Adjuntar diseno de referencia (opcional)'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                PNG JPG WEBP
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => setDesignFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {existingDesignUrl ? (
              <a
                href={existingDesignUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs font-bold text-primary underline-offset-4 hover:underline"
              >
                Ver diseno actual
              </a>
            ) : null}

            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Describe la personalizacion manual, instrucciones o consideraciones para revision..."
              rows={5}
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/20"
            />
          </section>
        </div>

        <aside className="space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-lg">
          <h2 className="text-lg font-black uppercase tracking-widest text-primary">Resumen</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Cliente</span>
              <span className="font-bold text-primary">
                {selectedProfile ? `${selectedProfile.firstName || 'Sin nombre'} ${selectedProfile.lastName || ''}`.trim() : 'Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Producto</span>
              <span className="font-bold text-primary">{selectedProduct?.name || 'Pendiente'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Variante</span>
              <span className="font-bold text-primary">{selectedVariant?.sku || 'Pendiente'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Cantidad</span>
              <span className="font-bold text-primary">{form.quantity || '0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Linea</span>
              <span className="font-bold text-primary">{form.line || 'Pendiente'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Material</span>
              <span className="font-bold text-primary">{form.material || 'Pendiente'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-base/40 px-4 py-3 text-xs text-muted">
            {isEditMode
              ? 'Los cambios actualizan la solicitud existente y recalculan su configuracion comercial.'
              : 'La solicitud se crea a nombre del cliente seleccionado y aparecera en el listado general para revision y aprobacion.'}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary py-4 font-black uppercase tracking-[0.2em] text-base-color disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {isEditMode ? 'Guardando...' : 'Creando...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5" />
                {isEditMode ? 'Guardar cambios' : 'Crear solicitud'}
              </span>
            )}
          </button>
        </aside>
      </form>
    </div>
  );
}
