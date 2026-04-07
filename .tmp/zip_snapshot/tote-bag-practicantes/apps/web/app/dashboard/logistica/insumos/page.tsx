'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Factory,
  Loader2,
  Phone,
  Plus,
  Search,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
} from '@/lib/numeric-input';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';

type Supplier = {
  id: string;
  name: string;
  nit: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  currentBalance?: number;
  _count?: {
    batches: number;
  };
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SuppliersPage() {
  const { accessToken } = useDashboardAuth();
  const router = useRouter();
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    nit: '',
    contact: '',
    phone: '',
    email: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    amountInput: '',
    amount: 0,
    description: '',
  });

  const resolveApiErrorMessage = useCallback(
    async (
      res: Response,
      fallbackMessage: string,
      options?: { redirectOnUnauthorized?: boolean; forbiddenMessage?: string },
    ) => {
      if (res.status === 401) {
        if (options?.redirectOnUnauthorized) {
          router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
        return 'Tu sesion expiro. Inicia sesion nuevamente.';
      }

      if (res.status === 403) {
        return (
          options?.forbiddenMessage ||
          'No tienes permisos para gestionar proveedores de insumos.'
        );
      }

      const body = await res.json().catch(() => null);

      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }

      if (Array.isArray(body?.message)) {
        const firstMessage = body.message.find(
          (value: unknown) => typeof value === 'string' && value.trim(),
        );

        if (firstMessage) {
          return firstMessage;
        }
      }

      if (typeof body?.error === 'string' && body.error.trim()) {
        return body.error;
      }

      return fallbackMessage;
    },
    [router],
  );

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token ?? accessToken;
    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [accessToken, supabase.auth]);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/inventory/suppliers', { headers });
      if (res.ok) {
        const body = await res.json();
        setSuppliers(body.data || body || []);
      } else {
        setError(
          await resolveApiErrorMessage(res, 'No fue posible cargar los proveedores de insumos.', {
            redirectOnUnauthorized: true,
          }),
        );
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setError('No fue posible conectar con la API de inventario.');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, resolveApiErrorMessage]);

  useEffect(() => {
    void fetchSuppliers();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!(session?.access_token ?? accessToken)) {
          setSuppliers([]);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN') {
          void fetchSuppliers();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [accessToken, fetchSuppliers, supabase.auth]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.nit,
        supplier.contact || '',
        supplier.phone || '',
        supplier.email || '',
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [search, suppliers]);

  const selectedSupplier =
    filteredSuppliers.find((supplier) => supplier.id === selectedSupplierId) ||
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ||
    filteredSuppliers[0] ||
    suppliers[0] ||
    null;

  useEffect(() => {
    if (!selectedSupplierId && suppliers[0]?.id) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [selectedSupplierId, suppliers]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittingSupplier(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/inventory/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          name: createForm.name,
          nit: createForm.nit,
          contact: createForm.contact || undefined,
          phone: createForm.phone || undefined,
          email: createForm.email || undefined,
        }),
      });

      if (!res.ok) {
        setError(
          await resolveApiErrorMessage(res, 'No fue posible crear el proveedor.', {
            redirectOnUnauthorized: true,
          }),
        );
        return;
      }

      setIsCreateModalOpen(false);
      setCreateForm({ name: '', nit: '', contact: '', phone: '', email: '' });
      await fetchSuppliers();
    } catch (error) {
      console.error(error);
      setError('No fue posible crear el proveedor.');
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const openPaymentModal = () => {
    if (!selectedSupplier) {
      return;
    }

    const balance = selectedSupplier.currentBalance || 0;
    const suggestedDescription = `Pago a proveedor ${selectedSupplier.name}`;

    setPaymentForm({
      amountInput: balance > 0 ? createCurrencyInputState(balance).formattedValue : '',
      amount: balance,
      description: suggestedDescription,
    });
    setError(null);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedSupplier) {
      setError('Selecciona un proveedor antes de registrar un pago.');
      return;
    }

    const currentBalance = selectedSupplier.currentBalance || 0;
    if (paymentForm.amount <= 0) {
      setError('El pago debe ser mayor a cero.');
      return;
    }

    if (paymentForm.amount > currentBalance) {
      setError('El pago no puede superar el saldo pendiente del proveedor.');
      return;
    }

    setSubmittingPayment(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch(`/inventory/suppliers/${selectedSupplier.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          amount: paymentForm.amount,
          description: paymentForm.description,
        }),
      });

      if (!res.ok) {
        setError(
          await resolveApiErrorMessage(res, 'No fue posible registrar el pago.', {
            redirectOnUnauthorized: true,
          }),
        );
        return;
      }

      setIsPaymentModalOpen(false);
      setPaymentForm({ amountInput: '', amount: 0, description: '' });
      await fetchSuppliers();
    } catch (paymentError) {
      console.error(paymentError);
      setError('No fue posible registrar el pago.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
              <Truck className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Directorio de Proveedores
            </h1>
          </div>
          <p className="font-medium text-muted">
            Gestion de alianzas comerciales y cuentas por pagar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard label="Proveedores" value={String(suppliers.length)} icon={<Factory className="h-5 w-5" />} />
        <MetricCard
          label="Con saldo pendiente"
          value={String(suppliers.filter((supplier) => (supplier.currentBalance || 0) > 0).length)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <MetricCard
          label="Saldo agregado"
          value={formatCurrency(suppliers.reduce((sum, supplier) => sum + (supplier.currentBalance || 0), 0))}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
            <div className="border-b border-theme bg-base/30 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, NIT o contacto..."
                    className="w-full rounded-xl border border-theme bg-base py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {error ? (
                  <p className="text-sm font-semibold text-rose-600">{error}</p>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                    <th className="px-8 py-4">Empresa / NIT</th>
                    <th className="px-8 py-4">Contacto</th>
                    <th className="px-8 py-4">Compras registradas</th>
                    <th className="px-8 py-4 text-right">Saldo actual</th>
                    <th className="px-8 py-4 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-14 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-14 text-center text-sm italic text-muted">
                        No hay proveedores de insumos para mostrar.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((supplier) => {
                      const isSelected = selectedSupplier?.id === supplier.id;

                      return (
                        <tr
                          key={supplier.id}
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          className={`cursor-pointer transition-all hover:bg-primary/5 ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-primary">{supplier.name}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                                {supplier.nit}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm font-medium text-muted">
                            {supplier.contact || supplier.phone || 'No asignado'}
                          </td>
                          <td className="px-8 py-5 font-bold text-primary">
                            {supplier._count?.batches || 0}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-primary">
                            {formatCurrency(supplier.currentBalance || 0)}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex justify-end">
                              <div className="rounded-lg border border-theme bg-base p-2 transition-all hover:bg-primary hover:text-base-color">
                                <ChevronRight className="h-4 w-4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedSupplier ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-base-color shadow-xl shadow-primary/20">
                <div className="relative z-10 space-y-6">
                  <div>
                    <h2 className="text-2xl font-black">{selectedSupplier.name}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-color/60">
                      {selectedSupplier.nit}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <a
                      href={selectedSupplier.phone ? `tel:${selectedSupplier.phone}` : '#'}
                      className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition-all hover:bg-white/20"
                    >
                      <Phone className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase">Llamar</span>
                    </a>
                    <a
                      href={
                        selectedSupplier.phone
                          ? `https://wa.me/${selectedSupplier.phone.replace(/\D/g, '')}`
                          : '#'
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3 transition-all hover:bg-emerald-600"
                    >
                      <WhatsAppIcon className="h-4 w-4 text-white" />
                      <span className="text-[10px] font-black uppercase">WhatsApp</span>
                    </a>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <p className="mb-1 text-[10px] font-black uppercase text-base-color/40">
                      Saldo actual
                    </p>
                    <p className="text-3xl font-black">
                      {formatCurrency(selectedSupplier.currentBalance || 0)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openPaymentModal}
                    disabled={(selectedSupplier.currentBalance || 0) <= 0}
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Registrar pago
                  </button>
                </div>
                <Truck className="absolute -bottom-4 -right-4 h-32 w-32 rotate-12 text-white/5" />
              </div>

              <div className="space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                  Resumen de relacion
                </h3>

                <DetailLine
                  label="Contacto"
                  value={selectedSupplier.contact || 'No registrado'}
                />
                <DetailLine
                  label="Telefono"
                  value={selectedSupplier.phone || 'No registrado'}
                />
                <DetailLine
                  label="Correo"
                  value={selectedSupplier.email || 'No registrado'}
                />
                <DetailLine
                  label="Lotes registrados"
                  value={String(selectedSupplier._count?.batches || 0)}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-theme bg-surface p-12 text-center">
              <div className="rounded-full bg-base p-4">
                <Truck className="h-8 w-8 text-muted" />
              </div>
              <p className="max-w-[220px] text-sm font-bold text-muted">
                Selecciona un proveedor para ver su ficha resumida.
              </p>
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}>
          <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-3xl border border-theme bg-surface p-8 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
              <h2 className="text-2xl font-black text-primary">Nuevo proveedor de insumos</h2>
              <p className="mt-1 text-sm text-muted">Registro basico para compras y recepcion de lotes.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nombre de la empresa"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
            <input
              value={createForm.nit}
              onChange={(event) => setCreateForm((current) => ({ ...current, nit: event.target.value }))}
              placeholder="NIT"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
            <input
              value={createForm.contact}
              onChange={(event) => setCreateForm((current) => ({ ...current, contact: event.target.value }))}
              placeholder="Nombre de contacto"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={createForm.phone}
              onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Telefono"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Correo"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingSupplier}
                className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color"
              >
                {submittingSupplier ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar proveedor'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isPaymentModalOpen && selectedSupplier ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <form
            onSubmit={handlePaymentSubmit}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-theme bg-surface p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-primary">Registrar pago</h2>
                <p className="mt-1 text-sm text-muted">
                  Aplica un pago al saldo pendiente de {selectedSupplier.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-theme bg-base/40 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                Saldo pendiente
              </p>
              <p className="mt-1 text-2xl font-black text-primary">
                {formatCurrency(selectedSupplier.currentBalance || 0)}
              </p>
            </div>

            <input
              value={paymentForm.amountInput}
              onChange={(event) =>
                handleCurrencyInputChangeWithState(event, (value) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amountInput: value.formattedValue,
                    amount: value.numericValue,
                  })),
                )
              }
              placeholder="Monto a pagar"
              className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
              inputMode="decimal"
              required
            />
            <textarea
              value={paymentForm.description}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Descripcion del pago"
              className="min-h-28 w-full rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
              required
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color"
              >
                {submittingPayment ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  'Confirmar pago'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <h3 className="mt-1 text-2xl font-black text-primary">{value}</h3>
    </div>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-base/40 px-4 py-3">
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className="text-sm font-black text-primary">{value}</span>
    </div>
  );
}
