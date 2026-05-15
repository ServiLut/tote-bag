'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Package, MapPin, Plus, Trash2, CheckCircle2, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AddressForm from '@/components/store/AddressForm';
import { apiFetch } from '@/utils/api';
import { COMPANY_INFO } from '@/utils/company-info';
import { translateStoreValue } from '@/lib/storefront-translations';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
  product: {
    name: string;
    images: { url: string }[];
  };
  variant?: {
    color: string;
    imageUrl: string;
  };
}

interface Order {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string;
  items: OrderItem[];
}

interface Address {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  department: { name: string };
  municipalityId: string;
  municipality: { name: string };
  address: string;
  neighborhood?: string;
  additionalInfo?: string;
  isDefault: boolean;
}

interface Profile {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
}

function getShippingSupportUrl(trackingNumber: string) {
  const cleanPhone = COMPANY_INFO.phone.replace(/\D/g, '');
  const message = encodeURIComponent(
    `Hola, necesito seguimiento para la guia ${trackingNumber}.`,
  );

  return `https://wa.me/${cleanPhone}?text=${message}`;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [userLabel, setUserLabel] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    setUserEmail(session.user.email || '');
    setUserLabel(session.user.email || '');
    setAccessToken(session.access_token);

    try {
      const [ordersRes, addressesRes, profileRes] = await Promise.all([
        apiFetch(`/orders/user/${session.user.id}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        apiFetch('/addresses', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        apiFetch('/profiles/me', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
      ]);

      if (ordersRes.ok) {
        const response = await ordersRes.json();
        setOrders(response.data || []);
      }

      if (addressesRes.ok) {
        const response = await addressesRes.json();
        setAddresses(response.data || []);
      } else {
        console.error('Addresses fetch failed:', await addressesRes.text());
        setAddresses([]);
      }

      if (profileRes.ok) {
        const response = await profileRes.json();
        const profile = (response.data || response) as Profile | null;
        setProfile(profile);
        const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
        if (fullName) {
          setUserLabel(fullName);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setAddresses([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const panel = searchParams.get('panel');

    if (panel === 'settings') {
      setShowSettingsModal(true);
    }

    if (panel === 'addresses') {
      setShowAddressForm(true);
    }
  }, [searchParams]);

  const handleDeleteAddress = async (id: string) => {
    if (!confirm(t('profile_delete_address_confirm'))) return;

    try {
      const res = await apiFetch(`/addresses/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        toast.success(t('profile_address_deleted'));
        fetchData();
      }
    } catch {
      toast.error(t('profile_delete_address_error'));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await apiFetch(`/addresses/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        toast.success(t('profile_default_address_updated'));
        fetchData();
      }
    } catch {
      toast.error(t('profile_update_address_error'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">{t('profile_title')}</h1>
            <p className="text-muted mt-1">{t('profile_welcome', { email: userLabel })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-xl border border-theme shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2 text-primary">
                  <MapPin className="w-5 h-5" /> {t('profile_saved_addresses')}
                </h2>
                <button
                  onClick={() => setShowAddressForm(true)}
                  className="p-1 hover:bg-base rounded-full transition-colors text-accent"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {addresses.length === 0 ? (
                  <p className="text-sm text-muted">{t('profile_no_addresses')}</p>
                ) : (
                  addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-4 rounded-lg border transition-all ${
                        address.isDefault ? 'border-accent/50 bg-accent/5' : 'border-theme bg-base/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-accent mb-1 block">
                            {address.title}
                          </span>
                          <p className="text-sm font-bold text-primary">
                            {address.firstName} {address.lastName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!address.isDefault && (
                            <button
                              onClick={() => handleSetDefault(address.id)}
                              className="text-muted hover:text-accent transition-colors"
                              title={t('profile_mark_default')}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            className="text-muted hover:text-red-500 transition-colors"
                            title={t('profile_delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        {address.address}
                        <br />
                        {address.neighborhood && `${address.neighborhood}, `}
                        {address.municipality.name}, {address.department.name}
                        <br />
                        {t('profile_phone_short', { phone: address.phone })}
                      </p>
                      {address.isDefault && (
                        <span className="mt-2 inline-block px-2 py-0.5 bg-accent text-surface text-[10px] font-bold rounded uppercase tracking-tighter">
                          {t('profile_default')}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowAddressForm(true)}
                className="mt-6 w-full py-2 text-sm font-bold border border-theme rounded-lg text-primary hover:bg-base transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t('profile_add_address')}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-surface rounded-xl border border-theme shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-theme">
                <h2 className="font-bold text-xl flex items-center gap-2 text-primary">
                  <Package className="w-5 h-5" /> {t('profile_orders')}
                </h2>
              </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-muted mb-4">{t('profile_no_orders')}</p>
                <button
                  onClick={() => router.push('/catalog')}
                  className="px-6 py-3 btn-primary text-sm font-bold uppercase tracking-wide rounded-sm"
                >
                  {t('profile_go_shop')}
                </button>
              </div>
            ) : (
              orders.map((order, index) => (
                <div key={order.id} className={index > 0 ? 'border-t border-theme' : ''}>
                  <div className="bg-primary/5 px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-b border-theme">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">
                          {t('profile_order_number')}
                        </span>
                        <span className="font-bold font-mono text-primary">{order.orderNumber}</span>
                      </div>
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">{t('profile_date')}</span>
                        <span className="font-medium text-primary">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">{t('profile_total')}</span>
                        <span className="font-medium text-primary">
                          ${order.totalAmount.toLocaleString('es-CO')}
                        </span>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                          {t('tax_included')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          order.status === 'ENTREGADA'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : order.status === 'ENVIADA'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : order.status === 'CANCELADA'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-green-400'
                                : 'bg-secondary/20 text-secondary'
                        }`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex gap-4 items-center">
                          <div className="relative w-16 h-20 bg-base rounded-md overflow-hidden shrink-0 border border-theme">
                            <Image
                              src={item.imageUrl || item.variant?.imageUrl || item.product.images[0]?.url || '/tote_bag_lifestyle.png'}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-primary">{item.product.name}</h4>
                            <p className="text-sm text-muted">
                              {translateStoreValue('color', item.variant?.color, t)} • {t('profile_quantity', { quantity: item.quantity })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-primary">${item.totalPrice.toLocaleString('es-CO')}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{t('tax_included')}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.trackingNumber && (
                      <div className="mt-6 pt-4 border-t border-theme flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted mr-2">{t('profile_tracking')}</span>
                          <span className="font-mono font-medium text-primary">{order.trackingNumber}</span>
                        </div>
                        <a
                          href={getShippingSupportUrl(order.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold underline decoration-1 text-primary hover:opacity-70 transition-opacity"
                        >
                          Solicitar seguimiento
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </main>

      {showAddressForm && (
        <AddressForm onClose={() => setShowAddressForm(false)} onSuccess={fetchData} token={accessToken} />
      )}

      {showSettingsModal ? (
        <ProfileSettingsModal
          profile={profile}
          addresses={addresses}
          token={accessToken}
          email={userEmail}
          onClose={() => setShowSettingsModal(false)}
          onManageAddresses={() => {
            setShowSettingsModal(false);
            setShowAddressForm(true);
          }}
          onSaved={() => {
            setShowSettingsModal(false);
            fetchData();
          }}
        />
      ) : null}
    </>
  );
}

function ProfilePageSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="h-12 w-56 rounded bg-base/60" />
    </main>
  );
}

function ProfileSettingsModal({
  profile,
  addresses,
  token,
  email,
  onClose,
  onSaved,
  onManageAddresses,
}: {
  profile: Profile | null;
  addresses: Address[];
  token: string;
  email: string;
  onClose: () => void;
  onSaved: () => void;
  onManageAddresses: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    phone: profile?.phone || '',
  });

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await apiFetch('/profiles/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('No fue posible actualizar tu perfil.');
      }

      toast.success('Perfil actualizado.');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-theme bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-theme px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">Configuracion</p>
            <h2 className="mt-1 text-2xl font-serif font-bold text-primary">Gestiona tu perfil</h2>
            <p className="mt-1 text-sm text-muted">Actualiza tu nombre y revisa la informacion principal de tu cuenta.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition-colors hover:bg-base hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 px-6 py-6">
          <div className="rounded-2xl border border-theme bg-base/40 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Correo</p>
            <p className="mt-1 text-sm font-semibold text-primary">{email}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Nombre</span>
              <input
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Apellido</span>
              <input
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Telefono</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="rounded-2xl border border-theme bg-base/40 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Direcciones</p>
                <p className="mt-1 text-sm font-semibold text-primary">
                  {addresses.length} {addresses.length === 1 ? 'direccion guardada' : 'direcciones guardadas'}
                </p>
                <p className="mt-1 text-sm text-muted">Administra tus direcciones de envio desde este acceso rapido.</p>
              </div>
              <button
                type="button"
                onClick={onManageAddresses}
                className="rounded-xl border border-theme px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-primary transition-colors hover:bg-base"
              >
                Gestionar
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-theme px-5 py-3 text-sm font-bold text-muted transition-colors hover:bg-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-base-color transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
