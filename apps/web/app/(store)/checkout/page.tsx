'use client';

import { Suspense, useEffect, useState } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { User, UserCircle2, Loader2, Plus, CheckCircle2 } from 'lucide-react';
import Script from 'next/script';
import { useTranslation } from 'react-i18next';
import { Combobox } from '@/components/ui/Combobox';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { apiFetch } from '@/utils/api';
import {
  getCheckoutEmptyCartRedirectPath,
  getCheckoutInitialAuthStep,
  getCheckoutLoginHref,
} from '@/lib/frontend-routing';
import { resolveWompiWidgetStatus } from '@/lib/wompi';
import { formatVariantSummary } from '@/lib/storefront-translations';

interface WompiWidgetOptions {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl: string;
  customerData: {
    email: string;
    fullName: string;
    phoneNumber: string;
    phoneNumberPrefix: string;
    legalId?: string;
    legalIdType?: string;
  };
}

interface WompiResult {
  transaction: {
    status: string;
    id: string;
    reference: string;
    [key: string]: unknown;
  };
}

interface WompiWidgetInstance {
  open: (callback: (result: WompiResult) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout: new (options: WompiWidgetOptions) => WompiWidgetInstance;
  }
}

interface LocationItem {
  id: string;
  name: string;
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

interface OrderPayload {
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  department: string;
  city: string;
  isB2B: boolean;
  shippingAddress: {
    city: string;
    address: string;
    phone: string;
  };
  items: {
    productId: string;
    variantId: string;
    sku: string;
    quantity: number;
    configuration?: {
      productId: string;
      variantId: string;
      line: string;
      size: string;
      material: string;
      quality?: string;
      customImageURL?: string;
      quantity: number;
      personalizations: {
        code: string;
        options: string[];        
      }[];
    };
  }[];
}

type GuestValidationErrors = Partial<
  Record<
    | 'email'
    | 'phone'
    | 'firstName'
    | 'lastName'
    | 'department'
    | 'city'
    | 'neighborhood'
    | 'address',
    string
  >
>;

function getCheckoutConfirmationPath(orderId: string) {
  return `/checkout/confirmacion?orderId=${encodeURIComponent(orderId)}`;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function getRequiredVariantId(item: CartItem) {
  if (!item.variant.id) {
    throw new Error(`El item ${item.product.name} no tiene variantId.`);
  }

  return item.variant.id;
}

const CUSTOM_TOTE_FALLBACK_IMAGE = '/tote_bag_lifestyle.png';

function getPrimaryProductImage(item: CartItem) {
  return [...(item.product.images || [])]
    .sort((left, right) => left.position - right.position)[0]?.url;
}

function getCheckoutItemImage(item: CartItem) {
  if (item.isCustom) {
    return item.customImageURL || CUSTOM_TOTE_FALLBACK_IMAGE;
  }

  return getPrimaryProductImage(item) || item.variant.imageUrl || CUSTOM_TOTE_FALLBACK_IMAGE;
}

function CheckoutItemImage({ item }: { item: CartItem }) {
  const [src, setSrc] = useState(() => getCheckoutItemImage(item));

  useEffect(() => {
    setSrc(getCheckoutItemImage(item));
  }, [item]);

  return (
    <Image
      src={src}
      alt={item.product.name}
      fill
      className="object-cover"
      onError={() => {
        if (src !== CUSTOM_TOTE_FALLBACK_IMAGE) {
          setSrc(CUSTOM_TOTE_FALLBACK_IMAGE);
        }
      }}
    />
  );
}

function CheckoutPageContent() {
  const { t } = useTranslation();
  const { items, subtotal } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isB2BParam = searchParams.get('isB2B');
  const isB2B = isB2BParam === 'true' || isB2BParam === '1';

  const supabase = createClient();
  const [authStep, setAuthStep] = useState<'CHOICE' | 'GUEST_FORM' | 'AUTHENTICATED'>('CHOICE');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [accessToken, setAccessToken] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    department: '',
    city: '',
    neighborhood: '',
    address: '',
  });

  const [departments, setDepartments] = useState<LocationItem[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationItem[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [guestErrors, setGuestErrors] = useState<GuestValidationErrors>({});
  const [wompiScriptLoaded, setWompiScriptLoaded] = useState(false);
  const [wompiScriptFailed, setWompiScriptFailed] = useState(false);

  const wompiWidgetStatus = resolveWompiWidgetStatus({
    scriptLoaded: wompiScriptLoaded,
    scriptFailed: wompiScriptFailed,
    widgetCheckout:
      typeof window === 'undefined' ? undefined : window.WidgetCheckout,
  });
  const isWompiWidgetReady = wompiWidgetStatus === 'ready';

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setAccessToken(session.access_token);
        setAuthStep(getCheckoutInitialAuthStep(true));
        setFormData((prev) => ({ ...prev, email: session.user.email || '' }));

        try {
          const res = await apiFetch('/addresses', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const result = await res.json();
            const addrList = result.data || [];
            setAddresses(addrList);
            const defaultAddr = addrList.find((a: Address) => a.isDefault) || addrList[0];
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          }
        } catch (error) {
          console.error('Error fetching addresses:', error);
        }
      }

      setIsInitializing(false);
    };

    checkSession();
  }, [supabase]);

  useEffect(() => {
    if (!isInitializing && items.length === 0) {
      router.push(getCheckoutEmptyCartRedirectPath());
    }
  }, [items, router, isInitializing]);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await apiFetch('/locations/departments');
        if (res.ok) {
          const result = await res.json();
          setDepartments(Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        setDepartments([]);
      }
    };

    fetchDepts();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setMunicipalities([]);
      return;
    }

    const fetchMunis = async () => {
      try {
        const res = await apiFetch(`/locations/municipalities/${selectedDeptId}`);
        if (res.ok) {
          const result = await res.json();
          setMunicipalities(Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.error('Error fetching municipalities:', error);
        setMunicipalities([]);
      }
    };

    fetchMunis();
  }, [selectedDeptId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setGuestErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name as keyof GuestValidationErrors];
      return next;
    });
  };

  const handleDeptChange = (id: string, name: string) => {
    setSelectedDeptId(id);
    setSelectedCityId('');
    setFormData((prev) => ({ ...prev, department: name, city: '' }));
    setGuestErrors((prev) => {
      const next = { ...prev };
      delete next.department;
      delete next.city;
      return next;
    });
  };

  const handleCityChange = (id: string, name: string) => {
    setSelectedCityId(id);
    setFormData((prev) => ({ ...prev, city: name }));
    setGuestErrors((prev) => {
      const next = { ...prev };
      delete next.city;
      return next;
    });
  };

  const validateGuestForm = () => {
    const errors: GuestValidationErrors = {};
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = normalizePhone(formData.phone.trim());
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedNeighborhood = formData.neighborhood.trim();
    const trimmedAddress = formData.address.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Ingresa un correo valido.';
    }

    if (!/^\+?\d{7,15}$/.test(trimmedPhone)) {
      errors.phone = 'Ingresa un telefono valido.';
    }

    if (trimmedFirstName.length < 2) {
      errors.firstName = 'Ingresa tus nombres completos.';
    }

    if (trimmedLastName.length < 2) {
      errors.lastName = 'Ingresa tus apellidos completos.';
    }

    if (!formData.department) {
      errors.department = 'Selecciona un departamento.';
    }

    if (!formData.city) {
      errors.city = 'Selecciona una ciudad o municipio.';
    }

    if (trimmedNeighborhood.length < 2) {
      errors.neighborhood = 'Ingresa barrio o referencia.';
    }

    if (trimmedAddress.length < 8) {
      errors.address = 'Ingresa una direccion mas completa.';
    }

    return errors;
  };

  const processCheckout = async (payload: OrderPayload) => {
    if (!isWompiWidgetReady) {
      const message =
        wompiWidgetStatus === 'loading'
          ? t('checkout_wompi_loading')
          : t('checkout_wompi_unavailable');
      toast.error(message);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Server Error Data:', errorData);
        throw new Error(errorData.message || t('checkout_order_error'));
      }

      const orderResult = await res.json();
      const orderId = orderResult.data?.id || orderResult.id;

      if (!orderId) throw new Error(t('checkout_missing_order_id'));

      const signRes = await apiFetch(`/payments/wompi/signature/${orderId}`);
      if (!signRes.ok) throw new Error(t('checkout_signature_error'));

      const signResult = await signRes.json();
      const signData = signResult.data;
      const widgetCheckout = window.WidgetCheckout;

      if (typeof widgetCheckout !== 'function') {
        throw new Error(t('checkout_wompi_unavailable'));
      }

      const checkout = new widgetCheckout({
        currency: signData.currency,
        amountInCents: signData.amountInCents,
        reference: signData.reference,
        publicKey: signData.publicKey,
        signature: { integrity: signData.signature },
        redirectUrl: `${window.location.origin}${getCheckoutConfirmationPath(orderId)}`,
        customerData: {
          email: payload.customerEmail,
          fullName: `${payload.firstName} ${payload.lastName}`,
          phoneNumber: payload.customerPhone,
          phoneNumberPrefix: '+57',
          legalId: '123456789',
          legalIdType: 'CC',
        },
      });

      checkout.open((result: WompiResult) => {
        console.log('Transaction Result:', result.transaction);
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t('checkout_process_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const buildItemConfiguration = (item: (typeof items)[number]) => {
    const raw = item.configuration as Record<string, unknown> | undefined;
    if (!raw) return undefined;

    const line = typeof raw.line === 'string' ? raw.line : '';
    const size = typeof raw.size === 'string' ? raw.size : '';
    const material = typeof raw.material === 'string' ? raw.material : '';
    const quality = typeof raw.quality === 'string' ? raw.quality : undefined;
    const customImageURL =
      typeof raw.customImageURL === 'string'
        ? raw.customImageURL
        : raw.customizationSettings &&
            typeof raw.customizationSettings === 'object' &&
            typeof (raw.customizationSettings as { customImageURL?: unknown })
              .customImageURL === 'string'
          ? ((raw.customizationSettings as { customImageURL: string })
              .customImageURL as string)
          : undefined;

    if (!line || !size || !material) return undefined;

    let personalizations: { code: string; options: string[] }[] = [];
    if (Array.isArray(raw.personalizations)) {
      personalizations = raw.personalizations
        .map((entry) => {
          const code =
            entry &&
            typeof entry === 'object' &&
            typeof (entry as { code?: unknown }).code === 'string'
              ? ((entry as { code: string }).code as string)
              : '';
          const options =
            entry &&
            typeof entry === 'object' &&
            Array.isArray((entry as { options?: unknown }).options)
              ? (entry as { options: unknown[] }).options.filter(
                  (opt): opt is string => typeof opt === 'string',
                )
              : [];
          return code ? { code, options } : null;
        })
        .filter((entry): entry is { code: string; options: string[] } => !!entry);
    } else if (typeof raw.markingType === 'string' && raw.markingType) {
      personalizations = [{ code: raw.markingType, options: [raw.markingType] }];
    }

    return {
      productId: item.product.id,
      variantId: getRequiredVariantId(item),
      line,
      size,
      material,
      ...(quality ? { quality } : {}),
      ...(customImageURL ? { customImageURL } : {}),
      quantity: item.quantity,
      personalizations,
    };
  };

  const handleGuestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateGuestForm();
    if (Object.keys(nextErrors).length > 0) {
      setGuestErrors(nextErrors);
      toast.error('Revisa los datos de envio antes de continuar.');
      return;
    }

    setGuestErrors({});

    const payload: OrderPayload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      customerEmail: formData.email.trim(),
      customerPhone: normalizePhone(formData.phone.trim()),
      department: formData.department,
      city: formData.city,
      isB2B: Boolean(isB2B),
      shippingAddress: {
        city: formData.city,
        address: `${formData.address.trim()} - ${formData.neighborhood.trim()}`,
        phone: normalizePhone(formData.phone.trim()),
      },
      items: items.map((item) => ({
        productId: item.product.id,
        variantId: getRequiredVariantId(item),
        sku: item.variant.sku,
        quantity: item.quantity,
        configuration: buildItemConfiguration(item),
      })),
    };

    await processCheckout(payload);
  };

  const handleAuthenticatedCheckout = async () => {
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) {
      toast.error(t('checkout_select_shipping_address'));
      return;
    }

    const payload: OrderPayload = {
      firstName: selectedAddress.firstName,
      lastName: selectedAddress.lastName,
      customerEmail: formData.email,
      customerPhone: selectedAddress.phone,
      department: selectedAddress.department.name,
      city: selectedAddress.municipality.name,
      isB2B: Boolean(isB2B),
      shippingAddress: {
        city: selectedAddress.municipality.name,
        address: `${selectedAddress.address}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''}`,
        phone: selectedAddress.phone,
      },
      items: items.map((item) => ({
        productId: item.product.id,
        variantId: getRequiredVariantId(item),
        sku: item.variant.sku,
        quantity: item.quantity,
        configuration: buildItemConfiguration(item),
      })),
    };

    await processCheckout(payload);
  };

  if (isInitializing || items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="lazyOnload"
        onLoad={() => {
          setWompiScriptLoaded(true);
          setWompiScriptFailed(false);
        }}
        onError={() => {
          setWompiScriptLoaded(false);
          setWompiScriptFailed(true);
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-serif font-bold text-primary mb-8">{t('checkout_title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            {authStep === 'CHOICE' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-6 text-primary">{t('checkout_continue_question')}</h2>
                <div className="grid gap-6">
                  <div
                    className="border border-theme rounded-lg"
                  >
                    <button
                      type="button"
                      className="w-full rounded-lg p-6 text-left hover:border-primary transition-colors cursor-pointer group"
                      onClick={() => router.push(getCheckoutLoginHref())}
                    >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">{t('checkout_existing_customer')}</h3>
                        <p className="text-sm text-muted">{t('checkout_existing_customer_desc')}</p>
                      </div>
                    </div>
                    </button>
                  </div>
                  <div className="border border-theme rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAuthStep('GUEST_FORM')}
                      className="w-full rounded-lg p-6 text-left hover:border-primary transition-colors cursor-pointer group"
                    >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <UserCircle2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">{t('checkout_guest')}</h3>
                        <p className="text-sm text-muted">{t('checkout_guest_desc')}</p>
                      </div>
                    </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {authStep === 'AUTHENTICATED' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">{t('checkout_shipping_address')}</h2>
                  <button
                    onClick={() => router.push('/profile')}
                    className="text-sm text-accent hover:opacity-80 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> {t('checkout_manage_addresses')}
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-theme rounded-lg">
                    <p className="text-muted mb-4 text-sm">{t('checkout_no_saved_addresses')}</p>
                    <button
                      onClick={() => router.push('/profile')}
                      className="px-6 py-2 bg-primary text-base-color font-bold text-xs uppercase tracking-widest rounded-sm"
                    >
                      {t('checkout_go_profile')}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {addresses.map((address) => (
                      <button
                        type="button"
                        key={address.id}
                        onClick={() => setSelectedAddressId(address.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all relative ${
                          selectedAddressId === address.id
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-theme bg-base/10 hover:border-accent/30'
                        }`}
                        aria-pressed={selectedAddressId === address.id}
                      >
                        {selectedAddressId === address.id && (
                          <div className="absolute top-4 right-4 text-accent">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="pr-10">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">
                            {address.title} {address.isDefault && t('checkout_default_label')}
                          </span>
                          <p className="text-sm font-bold text-primary mb-1">
                            {address.firstName} {address.lastName}
                          </p>
                          <p className="text-xs text-muted leading-relaxed">
                            {address.address}
                            <br />
                            {address.neighborhood && `${address.neighborhood}, `}
                            {address.municipality.name}, {address.department.name}
                          </p>
                          <p className="text-xs text-muted mt-2 font-medium">
                            {t('profile_phone_short', { phone: address.phone })}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={handleAuthenticatedCheckout}
                      disabled={isLoading || !selectedAddressId || !isWompiWidgetReady}
                      className="mt-6 w-full py-4 bg-primary text-base-color font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
                    >
                      {isLoading
                        ? t('checkout_processing')
                        : wompiWidgetStatus === 'loading'
                          ? t('checkout_wompi_loading')
                          : t('checkout_pay_wompi')}
                    </button>
                    <p className="mt-3 text-center text-xs text-muted">
                      {wompiWidgetStatus === 'unavailable'
                        ? t('checkout_wompi_unavailable')
                        : t('checkout_redirect_notice')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {authStep === 'GUEST_FORM' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">{t('checkout_shipping_data')}</h2>
                  <button
                    onClick={() => setAuthStep('CHOICE')}
                    className="text-sm text-muted hover:text-primary underline"
                    type="button"
                  >
                    {t('checkout_back')}
                  </button>
                </div>
                <form onSubmit={handleGuestCheckout} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_email')}</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                      placeholder="tu@email.com"
                    />
                    {guestErrors.email ? <p className="text-xs font-medium text-red-600">{guestErrors.email}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_phone')}</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                      placeholder="+57 300..."
                    />
                    {guestErrors.phone ? <p className="text-xs font-medium text-red-600">{guestErrors.phone}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_names')}</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                    />
                    {guestErrors.firstName ? <p className="text-xs font-medium text-red-600">{guestErrors.firstName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_last_names')}</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                    />
                    {guestErrors.lastName ? <p className="text-xs font-medium text-red-600">{guestErrors.lastName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_department')}</label>
                    <Combobox
                      options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
                      value={selectedDeptId}
                      onChange={handleDeptChange}
                      placeholder={t('checkout_select_department')}
                      searchPlaceholder={t('checkout_search_department')}
                    />
                    {guestErrors.department ? <p className="text-xs font-medium text-red-600">{guestErrors.department}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_city')}</label>
                    <Combobox
                      options={(municipalities || []).map((m) => ({ value: m.id, label: m.name }))}
                      value={selectedCityId}
                      onChange={handleCityChange}
                      placeholder={t('checkout_select_city')}
                      searchPlaceholder={t('checkout_search_city')}
                      disabled={!selectedDeptId}
                      emptyMessage={selectedDeptId ? t('checkout_no_cities_found') : t('checkout_select_department_first')}
                    />
                    {guestErrors.city ? <p className="text-xs font-medium text-red-600">{guestErrors.city}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_neighborhood')}</label>
                    <input
                      type="text"
                      name="neighborhood"
                      required
                      value={formData.neighborhood}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                    />
                    {guestErrors.neighborhood ? <p className="text-xs font-medium text-red-600">{guestErrors.neighborhood}</p> : null}
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">{t('checkout_exact_address')}</label>
                    <input
                      type="text"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary"
                      placeholder={t('checkout_exact_address_placeholder')}
                    />
                    {guestErrors.address ? <p className="text-xs font-medium text-red-600">{guestErrors.address}</p> : null}
                  </div>
                  <div className="col-span-full pt-4">
                    <button
                      type="submit"
                      disabled={isLoading || !isWompiWidgetReady}
                      className="w-full py-4 btn-primary font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
                    >
                      {isLoading
                        ? t('checkout_processing')
                        : wompiWidgetStatus === 'loading'
                          ? t('checkout_wompi_loading')
                          : t('checkout_continue_wompi')}
                    </button>
                    <p className="text-center text-xs text-muted mt-4">
                      {wompiWidgetStatus === 'unavailable'
                        ? t('checkout_wompi_unavailable')
                        : t('checkout_redirect_notice')}
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-surface p-6 rounded-lg shadow-sm border border-theme sticky top-24">
              <h3 className="font-bold text-lg mb-4 text-primary">{t('checkout_summary')}</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-theme">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-16 h-20 bg-base rounded overflow-hidden shrink-0 border border-theme">
                      <CheckoutItemImage item={item} />
                      <span className="absolute top-0 right-0 bg-primary/10 backdrop-blur-sm text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-bl">
                        x{item.quantity}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium line-clamp-2 text-primary">{item.product.name}</h4>
                      <p className="text-xs text-muted">
                        {formatVariantSummary(item.variant.size, item.variant.color, t)}
                      </p>
                      <p className="text-sm font-semibold mt-1 text-primary">
                        ${(item.unitPrice * item.quantity).toLocaleString('es-CO')}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        {t('tax_included')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-theme pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('cart_subtotal')}</span>
                  <span className="text-right">
                    <span className="block text-primary">${subtotal.toLocaleString('es-CO')}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">{t('tax_included')}</span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('cart_shipping')}</span>
                  <span className="text-muted/60 text-xs italic">Se confirma por soporte antes del despacho.</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-theme mt-2 text-primary">
                  <span>Total parcial</span>
                  <span className="text-right">
                    <span className="block">${subtotal.toLocaleString('es-CO')}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">{t('tax_included')}</span>
                  </span>
                </div>
                <p className="text-xs text-muted pt-2">
                  El valor mostrado corresponde a productos. El envio se confirma por separado mientras la integracion de flete sigue en ajuste.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
