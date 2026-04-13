'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { Badge, Input, InputGroup } from '@tote-bag/ui';
import { Combobox } from '@/components/ui/Combobox';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
  sanitizeIntegerInput,
} from '@/lib/numeric-input';
import { ApiResponse } from '@/types/api';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

interface Profile {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  department?: string | null;
  municipality?: string | null;
  address?: string | null;
}

interface Variant {
  id: string;
  sku: string;
  size?: string;
  color: string;
  stock: number;
  salePrice?: number | null;
}

interface Product {
  id: string;
  name: string;
  // Transitional compatibility for legacy API consumers.
  basePrice: number;
  variants: Variant[];
}

interface ShippingProvider {
  id: string;
  name: string;
}

interface OrderItem {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  size?: string;
  color: string;
  quantity: number;
  price: number;
  stock: number;
}

interface CreatedOrder {
  id: string;
  orderNumber: number;
}

interface LocationOption {
  id: string;
  name: string;
}

export default function NewManualOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [departments, setDepartments] = useState<LocationOption[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationOption[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searchProfile, setSearchProfile] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(() => createCurrencyInputState(0));
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [initialStatus, setInitialStatus] = useState('PENDIENTE_PAGO');
  const [shippingData, setShippingData] = useState({
    providerId: '',
    providerName: '',
    address: '',
    city: '',
    cityId: '',
    department: '',
    departmentId: '',
    phone: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [profilesRes, productsRes, providersRes, departmentsRes] = await Promise.all([
        apiFetch('/profiles', {
          headers: authHeaders,
        }),
        apiFetch('/catalog/admin/products', {
          headers: authHeaders,
        }),
        apiFetch('/shipping/providers', {
          headers: authHeaders,
        }),
        apiFetch('/locations/departments'),
      ]);

      if (!profilesRes.ok || !productsRes.ok) {
        const errors = [
          !profilesRes.ok ? `profiles:${profilesRes.status}` : null,
          !productsRes.ok ? `products:${productsRes.status}` : null,
        ].filter(Boolean);

        throw new Error(`No se pudo cargar la informacion del formulario. ${errors.join(' | ')}`);
      }

      const [profilesJson, productsJson]: [
        ApiResponse<Profile[]>,
        ApiResponse<Product[]>,
      ] = await Promise.all([
        profilesRes.json(),
        productsRes.json(),
      ]);

      let providersJson: ApiResponse<ShippingProvider[]> | null = null;
      if (providersRes.ok) {
        providersJson = await providersRes.json();
        setProvidersError(null);
      } else {
        setProvidersError(`No se pudieron cargar las transportadoras (${providersRes.status}). Puedes escribirla manualmente.`);
      }

      let departmentsJson: ApiResponse<LocationOption[]> | null = null;
      if (departmentsRes.ok) {
        departmentsJson = await departmentsRes.json();
      }

      setProfiles(profilesJson.data || []);
      setProducts(productsJson.data || []);
      setProviders(providersJson?.data || []);
      setDepartments(departmentsJson?.data || []);
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la informacion necesaria para crear el pedido.',
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase.auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchMunicipalities = useCallback(async (departmentId: string) => {
    setLoadingMunicipalities(true);
    try {
      const res = await apiFetch(`/locations/municipalities/${departmentId}`);
      if (res.ok) {
        const json: ApiResponse<LocationOption[]> = await res.json();
        setMunicipalities(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching municipalities:', error);
    } finally {
      setLoadingMunicipalities(false);
    }
  }, []);

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

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = discountType === 'amount'
    ? discount.numericValue
    : (subtotal * discount.numericValue) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setSearchProfile('');
    
    // Try to find department ID if name matches
    const dept = departments.find(d => d.name.toLowerCase() === profile.department?.toLowerCase());
    if (dept) {
      fetchMunicipalities(dept.id);
    }

    setShippingData((current) => ({
      ...current,
      address: profile.address || '',
      city: profile.municipality || '',
      department: profile.department || '',
      departmentId: dept?.id || '',
      phone: profile.phone || '',
    }));
  };

  const addItem = () => {
    if (!selectedProduct || !selectedVariantId) return;
    const variant = selectedProduct.variants.find((item) => item.id === selectedVariantId);
    if (!variant || variant.stock <= 0) {
      setFormError('La variante seleccionada no tiene stock disponible.');
      return;
    }

    setFormError(null);
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.variantId === variant.id);
      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        if (existing.quantity >= existing.stock) {
          setFormError(`No puedes superar el stock disponible para ${selectedProduct.name}.`);
          return current;
        }
        const next = [...current];
        next[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
        return next;
      }

      return [
        ...current,
        {
          productId: selectedProduct.id,
          variantId: variant.id,
          sku: variant.sku,
          name: selectedProduct.name,
          size: variant.size,
          color: variant.color,
          quantity: 1,
          price: variant.salePrice ?? 0,
          stock: variant.stock,
        },
      ];
    });
    setSelectedProductId('');
    setSelectedVariantId('');
  };

  const updateItemQty = (index: number, qtyInput: string) => {
    const sanitizedValue = sanitizeIntegerInput(qtyInput);
    if (sanitizedValue === null) return;

    const qty = parseInt(sanitizedValue, 10) || 1;
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: Math.min(Math.max(1, qty || 1), item.stock) }
          : item,
      ),
    );
  };

  const validateForm = () => {
    if (!selectedProfile) return 'Selecciona un cliente.';
    if (items.length === 0) return 'Agrega al menos un producto.';
    if (!shippingData.providerId && !shippingData.providerName.trim()) {
      return 'Selecciona o escribe una transportadora.';
    }
    if (!shippingData.phone.trim()) return 'Ingresa un telefono de entrega.';
    if (!shippingData.department.trim()) return 'Ingresa un departamento.';
    if (!shippingData.city.trim()) return 'Ingresa una ciudad o municipio.';
    if (!shippingData.address.trim()) return 'Ingresa una direccion completa.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!selectedProfile) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('La sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch('/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: selectedProfile.firstName || 'Cliente',
          lastName: selectedProfile.lastName || 'Manual',
          customerEmail: selectedProfile.email,
          customerPhone: selectedProfile.phone || shippingData.phone,
          department: shippingData.department,
          city: shippingData.city,
          shippingAddress: {
            address: shippingData.address,
            city: shippingData.city,
            phone: shippingData.phone,
          },
          profileId: selectedProfile.id,
          shippingProviderId: shippingData.providerId,
          carrier: shippingData.providerName || undefined,
          isManual: true,
          source: 'MANUAL',
          initialStatus,
          manualDiscountType: discountType,
          manualDiscountValue: discount.numericValue,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            quantity: item.quantity,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || json?.error || 'No se pudo crear el pedido.');
      }

      setCreatedOrder(json.data as CreatedOrder);
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Error de conexion al crear el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const departmentOptions = useMemo(() => 
    departments.map(d => ({ value: d.id, label: d.name })),
  [departments]);

  const municipalityOptions = useMemo(() => 
    municipalities.map(m => ({ value: m.id, label: m.name })),
  [municipalities]);

  const downloadProtectedFile = useCallback(
    async (path: string, fallbackFileName: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('La sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch(path, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo descargar el archivo.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    [supabase.auth],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Cargando formulario...</p>
      </div>
    );
  }

  if (createdOrder) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 p-8 text-center md:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-primary">Pedido Creado</h1>
          <p className="mt-2 text-muted">La orden #{createdOrder.orderNumber} se registro correctamente.</p>
        </div>
        <div className="grid gap-3">
          <button
            onClick={async () => {
              try {
                await downloadProtectedFile(
                  `/orders/${createdOrder.id}/receipt`,
                  `Recibo_Orden_${createdOrder.orderNumber}.pdf`,
                );
              } catch (error) {
                console.error(error);
                setFormError(
                  error instanceof Error
                    ? error.message
                    : 'No se pudo descargar el recibo.',
                );
              }
            }}
            className="rounded-2xl bg-primary p-4 font-black uppercase tracking-widest text-base-color"
          >
            <span className="flex items-center justify-center gap-2"><Printer className="h-5 w-5" />Descargar Recibo</span>
          </button>
          <button onClick={() => {
            const phone = (selectedProfile?.phone || shippingData.phone || '').replace(/\D/g, '');
            const firstName = selectedProfile?.firstName || 'cliente';
            const message = `Hola ${firstName}. Adjunto el recibo de tu pedido #${createdOrder.orderNumber}. Gracias por tu compra en Tote Bag.`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
          }} className="rounded-2xl bg-emerald-500 p-4 font-black uppercase tracking-widest text-white transition-all hover:scale-[1.01] hover:bg-emerald-600">
            <span className="flex items-center justify-center gap-2.5"><WhatsAppIcon className="h-5 w-5 text-white" />Enviar por WhatsApp</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-xl border border-theme bg-surface p-2">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary">Nuevo Pedido Manual</h1>
          <p className="text-sm font-medium text-muted">Crea una orden con transporte y descuento manual persistidos.</p>
        </div>
      </div>

      {formError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Cliente</h2>
            {selectedProfile ? (
              <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <div>
                  <p className="font-bold text-primary">{selectedProfile.firstName || 'Sin nombre'} {selectedProfile.lastName || ''}</p>
                  <p className="text-xs text-muted">{selectedProfile.email}</p>
                </div>
                <button onClick={() => setSelectedProfile(null)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input value={searchProfile} onChange={(event) => setSearchProfile(event.target.value)} placeholder="Buscar cliente por nombre o email..." className="w-full rounded-2xl border border-theme bg-base py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
                  {filteredProfiles.length > 0 && (
                    <div className="absolute z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-theme bg-surface shadow-xl">
                      {filteredProfiles.map((profile) => (
                        <button key={profile.id} onClick={() => handleSelectProfile(profile)} className="flex w-full items-center justify-between border-b border-theme px-4 py-3 text-left hover:bg-primary/5 last:border-0">
                          <div>
                            <p className="text-sm font-bold text-primary">{profile.firstName || 'Sin nombre'} {profile.lastName || ''}</p>
                            <p className="text-[10px] text-muted">{profile.email}</p>
                          </div>
                          <Plus className="h-4 w-4 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Link href="/register" target="_blank" className="block rounded-2xl border border-theme bg-primary/5 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-primary">
                  Crear Nuevo Cliente en Registro
                </Link>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Productos</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value); setSelectedVariantId(''); }} className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Selecciona producto...</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} disabled={!selectedProduct} className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
                <option value="">Selecciona variante...</option>
                {selectedProduct?.variants.map((variant) => (
                  <option key={variant.id} value={variant.id} disabled={variant.stock <= 0}>
                    {[variant.size, variant.color, variant.sku].filter(Boolean).join(' | ')} | Stock {variant.stock}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={addItem} disabled={!selectedProduct || !selectedVariantId} className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-base-color disabled:opacity-50">
              Agregar Producto
            </button>

            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-theme py-8 text-center text-sm text-muted">Aun no has anadido productos.</div>
              ) : items.map((item, index) => (
                <div key={item.variantId} className="flex items-center justify-between gap-4 rounded-2xl border border-theme p-4">
                  <div>
                    <p className="font-bold text-primary">{item.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                      {[item.size, item.color, item.sku].filter(Boolean).join(' | ')}
                    </p>
                    <Badge className="mt-2 border-emerald-100 bg-emerald-50 text-emerald-600">Stock: {item.stock}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={String(item.quantity)}
                      onChange={(event) => updateItemQty(index, event.target.value)}
                      className="w-16 rounded-lg border border-theme bg-base px-2 py-1 text-center font-bold"
                    />
                    <span className="w-24 text-right text-sm font-black text-primary">{formatCurrency(item.quantity * item.price)}</span>
                    <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-3xl border border-theme bg-surface p-6 md:grid-cols-2">
            <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
              <select value={shippingData.providerId} onChange={(event) => setShippingData((current) => ({ ...current, providerId: event.target.value, providerName: current.providerName || providers.find((provider) => provider.id === event.target.value)?.name || '' }))} className="rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Selecciona transportadora...</option>
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <input value={shippingData.providerName} onChange={(event) => setShippingData((current) => ({ ...current, providerName: event.target.value, providerId: current.providerId && providers.some((provider) => provider.id === current.providerId && provider.name === event.target.value) ? current.providerId : '' }))} placeholder="Transportadora manual" className="rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            
            <input value={shippingData.phone} onChange={(event) => setShippingData((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefono de entrega" className="rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20 md:col-span-2" />
            
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted px-1">Departamento</p>
              <Combobox 
                options={departmentOptions}
                value={shippingData.departmentId}
                onChange={(id, name) => {
                  setShippingData(current => ({
                    ...current,
                    department: name,
                    departmentId: id,
                    city: '',
                    cityId: ''
                  }));
                  fetchMunicipalities(id);
                }}
                placeholder="Seleccionar departamento..."
                searchPlaceholder="Buscar departamento..."
              />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted px-1">Ciudad o municipio</p>
              <Combobox 
                options={municipalityOptions}
                value={shippingData.cityId}
                onChange={(id, name) => {
                  setShippingData(current => ({
                    ...current,
                    city: name,
                    cityId: id
                  }));
                }}
                placeholder="Seleccionar municipio..."
                searchPlaceholder="Buscar municipio..."
                disabled={!shippingData.departmentId || loadingMunicipalities}
                emptyMessage={loadingMunicipalities ? "Cargando..." : "No hay resultados."}
              />
            </div>

            <input value={shippingData.address} onChange={(event) => setShippingData((current) => ({ ...current, address: event.target.value }))} placeholder="Direccion completa" className="rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20 md:col-span-2" />
          </section>
          {providersError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {providersError}
            </div>
          )}
        </div>

        <aside className="space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-lg">
          <h2 className="text-lg font-black uppercase tracking-widest text-primary">Resumen</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">Subtotal</span><span className="font-bold text-primary">{formatCurrency(subtotal)}</span></div>
            <div className="space-y-2 rounded-2xl border border-theme bg-base/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">Descuento</span>
                <div className="flex overflow-hidden rounded-lg border border-theme">
                  <button onClick={() => setDiscountType('amount')} className={`px-2 py-1 text-[10px] font-black ${discountType === 'amount' ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>$</button>
                  <button onClick={() => setDiscountType('percent')} className={`px-2 py-1 text-[10px] font-black ${discountType === 'percent' ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>%</button>
                </div>
              </div>
              <InputGroup
                prefix={discountType === 'amount' ? <span className="font-black text-muted">$</span> : undefined}
                className="flex items-center gap-2 rounded-xl border border-theme bg-surface px-3"
              >
                <Input
                  type="text"
                  inputMode="decimal"
                  value={discount.formattedValue}
                  onChange={(event) => handleCurrencyInputChangeWithState(event, setDiscount)}
                  className="w-full bg-transparent py-2 text-right font-black outline-none focus:ring-0"
                />
              </InputGroup>
              {discount.numericValue > 0 && <div className="flex items-center justify-between text-rose-500"><span className="text-[10px] font-black uppercase tracking-widest">Descuento Aplicado</span><span className="font-black">-{formatCurrency(discountAmount)}</span></div>}
            </div>
            <div className="flex items-center justify-between border-t border-theme pt-3"><span className="font-black uppercase tracking-widest text-primary">Total</span><span className="text-2xl font-black text-primary">{formatCurrency(total)}</span></div>
          </div>
          <select value={initialStatus} onChange={(event) => setInitialStatus(event.target.value)} className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-black outline-none focus:ring-2 focus:ring-primary/20">
            <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
            <option value="PAGADA">Pagada / Confirmada</option>
            <option value="EN_PRODUCCION">En Produccion</option>
          </select>
          <button disabled={submitting} onClick={handleSubmit} className="w-full rounded-2xl bg-primary py-4 font-black uppercase tracking-[0.2em] text-base-color disabled:opacity-50">
            {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Creando...</span> : 'Crear Pedido'}
          </button>
        </aside>
      </div>
    </div>
  );
}
