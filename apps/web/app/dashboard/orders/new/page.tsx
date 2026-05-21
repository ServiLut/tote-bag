'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { ReceiptUpload } from '@/components/dashboard/ReceiptUpload';
import { Badge, Input, InputGroup } from '@tote-bag/ui';
import { Combobox } from '@/components/ui/Combobox';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
  sanitizeIntegerInput,
} from '@/lib/numeric-input';
import {
  getManualOrderContactPhone,
  getManualOrderUnitPrice,
} from '@/lib/manual-order';
import {
  extractApiErrorMessage,
  formatApiConnectionErrorMessage,
  getApiResponseErrorMessage,
} from '@/lib/api-error';
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
  departmentId?: string | null;
  municipalityId?: string | null;
}

interface Variant {
  id: string;
  sku: string;
  size?: string;
  color: string;
  stock: number;
  salePrice?: number | string | null;
  minPrice?: number | string | null;
  isActive?: boolean;
}

interface Product {
  id: string;
  name: string;
  // Transitional compatibility for legacy API consumers.
  basePrice: number | string;
  variants: Variant[];
}

function normalizeCatalogMoney(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getCatalogReferencePrice(product: Product) {
  const activeVariants = product.variants.filter(
    (variant) => variant.isActive !== false,
  );
  const referenceVariant =
    activeVariants
      .filter(
        (variant) => normalizeCatalogMoney(variant.salePrice) > 0,
      )
      .sort(
        (left, right) =>
          normalizeCatalogMoney(left.salePrice) -
          normalizeCatalogMoney(right.salePrice),
      )[0]
    || activeVariants[0]
    || product.variants[0]
    || null;

  const referenceVariantSalePrice = normalizeCatalogMoney(
    referenceVariant?.salePrice,
  );
  if (referenceVariantSalePrice > 0) {
    return referenceVariantSalePrice;
  }

  return normalizeCatalogMoney(product.basePrice);
}

function serializeDecimalForApi(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function serializeDateForApi(value: string) {
  return `${value}T12:00:00.000Z`;
}

function extractStorageRef(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    storageRef?: unknown;
    data?: {
      storageRef?: unknown;
    };
  };

  if (typeof candidate.storageRef === 'string') {
    return candidate.storageRef;
  }

  if (
    candidate.data &&
    typeof candidate.data === 'object' &&
    typeof candidate.data.storageRef === 'string'
  ) {
    return candidate.data.storageRef;
  }

  return null;
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

interface ManualCustomerFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  municipalityId: string;
  neighborhood: string;
  address: string;
}

interface ProfilesListPayload {
  items: Profile[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const INITIAL_MANUAL_CUSTOMER_FORM: ManualCustomerFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  departmentId: '',
  municipalityId: '',
  neighborhood: '',
  address: '',
};

export default function NewManualOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [departments, setDepartments] = useState<LocationOption[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationOption[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<string | null>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [hasCompletedCustomerSearch, setHasCompletedCustomerSearch] = useState(false);
  const [createCustomerForm, setCreateCustomerForm] = useState<ManualCustomerFormState>(INITIAL_MANUAL_CUSTOMER_FORM);
  const [createCustomerMunicipalities, setCreateCustomerMunicipalities] = useState<LocationOption[]>([]);

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searchProfile, setSearchProfile] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(() => createCurrencyInputState(0));
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [initialStatus, setInitialStatus] = useState<'PENDIENTE_PAGO' | 'PAGADA'>('PENDIENTE_PAGO');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
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
      setFormError(null);

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

      const [productsResult, providersResult, departmentsResult] = await Promise.allSettled([
        apiFetch('/catalog/admin/products', {
          headers: authHeaders,
        }),
        apiFetch('/shipping/providers', {
          headers: authHeaders,
        }),
        apiFetch('/locations/departments'),
      ]);

      if (productsResult.status === 'fulfilled') {
        const productsRes = productsResult.value;
        if (productsRes.ok) {
          const productsJson: ApiResponse<Product[]> = await productsRes.json();
          setProducts(productsJson.data || []);
          setProductsError(null);
        } else {
          setProducts([]);
          setProductsError(
            await getApiResponseErrorMessage(
              productsRes,
              `No se pudieron cargar los productos (${productsRes.status}).`,
              'productos del catalogo',
            ),
          );
        }
      } else {
        setProducts([]);
        setProductsError(
          formatApiConnectionErrorMessage(
            productsResult.reason instanceof Error
              ? productsResult.reason.message
              : 'No fue posible conectar con la API.',
            'productos del catalogo',
          ),
        );
      }

      if (providersResult.status === 'fulfilled') {
        const providersRes = providersResult.value;
        if (providersRes.ok) {
          const providersJson: ApiResponse<ShippingProvider[]> = await providersRes.json();
          setProviders(providersJson.data || []);
          setProvidersError(null);
        } else {
          setProviders([]);
          setProvidersError(`No se pudieron cargar las transportadoras (${providersRes.status}). Puedes escribirla manualmente.`);
        }
      } else {
        setProviders([]);
        setProvidersError('No fue posible cargar las transportadoras. Puedes escribirla manualmente.');
      }

      if (departmentsResult.status === 'fulfilled' && departmentsResult.value.ok) {
        const departmentsJson: ApiResponse<LocationOption[]> = await departmentsResult.value.json();
        setDepartments(departmentsJson.data || []);
      } else {
        setDepartments([]);
      }
    } catch (error) {
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

  const fetchCustomerProfiles = useCallback(async (
    term: string,
    signal: AbortSignal,
  ) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams({
        role: 'CUSTOMER',
        search: term,
        page: '1',
        pageSize: '8',
      });

      const response = await apiFetch(`/profiles?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`No se pudieron buscar clientes (${response.status}).`);
      }

      const body: ApiResponse<ProfilesListPayload | Profile[]> = await response.json();
      const payload = body.data;
      const items = Array.isArray(payload) ? payload : payload?.items || [];

      setProfiles(items);
      setCustomerSearchError(null);
      setHasCompletedCustomerSearch(true);
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      console.error('Error searching customers:', error);
      setProfiles([]);
      setCustomerSearchError(
        error instanceof Error
          ? error.message
          : 'No se pudieron buscar clientes.',
      );
      setHasCompletedCustomerSearch(true);
    } finally {
      if (!signal.aborted) {
        setCustomerSearchLoading(false);
      }
    }
  }, [router, supabase.auth]);

  useEffect(() => {
    const term = searchProfile.trim();
    if (selectedProfile || term.length <= 2) {
      setProfiles([]);
      setCustomerSearchLoading(false);
      setCustomerSearchError(null);
      setHasCompletedCustomerSearch(false);
      return;
    }

    const controller = new AbortController();
    setCustomerSearchLoading(true);
    setCustomerSearchError(null);
    setHasCompletedCustomerSearch(false);

    const timeoutId = window.setTimeout(() => {
      void fetchCustomerProfiles(term, controller.signal);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [fetchCustomerProfiles, searchProfile, selectedProfile]);

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
    const resolvedDepartmentId =
      profile.departmentId ||
      departments.find(
        (department) =>
          department.name.toLowerCase() === profile.department?.toLowerCase(),
      )?.id ||
      '';

    setSelectedProfile(profile);
    setSearchProfile('');
    setCustomerSearchError(null);
    setHasCompletedCustomerSearch(false);

    if (resolvedDepartmentId) {
      void fetchMunicipalities(resolvedDepartmentId);
    } else {
      setMunicipalities([]);
    }

    setShippingData((current) => ({
      ...current,
      address: profile.address || '',
      city: profile.municipality || '',
      cityId: profile.municipalityId || '',
      department: profile.department || '',
      departmentId: resolvedDepartmentId,
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
          price:
            getCatalogReferencePrice(selectedProduct) ||
            getManualOrderUnitPrice({
              salePrice: normalizeCatalogMoney(variant.salePrice),
              minPrice: normalizeCatalogMoney(variant.minPrice),
            }),
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
    if (
      initialStatus === 'PAGADA' &&
      !paymentReceiptUrl.trim() &&
      !paymentReceiptFile
    ) {
      return 'Adjunta un comprobante o registra una URL/referencia privada del soporte de pago.';
    }
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
    setCreationNotice(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('La sesion expiro. Inicia sesion de nuevo.');
      }

      const shouldConfirmOrder = initialStatus === 'PAGADA';
      const shouldUploadReceiptAfterCreation =
        shouldConfirmOrder && Boolean(paymentReceiptFile);
      const normalizedPaymentReceiptUrl = paymentReceiptUrl.trim();

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
          customerPhone: getManualOrderContactPhone(
            shippingData.phone,
            selectedProfile.phone,
          ),
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
          initialStatus: shouldUploadReceiptAfterCreation
            ? 'PENDIENTE_PAGO'
            : initialStatus,
          manualDiscountType: discountType,
          manualDiscountValue: discount.numericValue,
          paymentReceiptUrl:
            shouldConfirmOrder && !shouldUploadReceiptAfterCreation
              ? normalizedPaymentReceiptUrl || undefined
              : undefined,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            quantity: item.quantity,
          })),
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || json?.error || 'No se pudo crear el pedido.');
      }

      const nextCreatedOrder = json?.data as CreatedOrder | undefined;

      if (!nextCreatedOrder?.id) {
        throw new Error('La orden se creo, pero la API no devolvio su identificador.');
      }

      if (!shouldConfirmOrder) {
        setCreatedOrder(nextCreatedOrder);
        return;
      }

      if (!shouldUploadReceiptAfterCreation) {
        setCreationNotice('El pedido se registro como pagado con su soporte asociado.');
        setCreatedOrder(nextCreatedOrder);
        return;
      }

      let postCreationWarning: string | null = null;

      try {
        const receiptFileToUpload = paymentReceiptFile;
        if (!receiptFileToUpload) {
          throw new Error('No se encontro el archivo del comprobante para cerrar el pago.');
        }

        const receiptFormData = new FormData();
        receiptFormData.append('file', receiptFileToUpload);

        const uploadResponse = await apiFetch(
          `/payments/upload-receipt/order/${nextCreatedOrder.id}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: receiptFormData,
          },
        );

        const uploadBody = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok) {
          throw new Error(
            extractApiErrorMessage(
              uploadBody,
              'No fue posible subir el comprobante del pedido.',
            ),
          );
        }

        const storageRef = extractStorageRef(uploadBody);
        if (!storageRef) {
          throw new Error(
            'La API no devolvio la referencia privada del comprobante.',
          );
        }

        const paymentResponse = await apiFetch(
          `/orders/${nextCreatedOrder.id}/payments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              amount: serializeDecimalForApi(total),
              paymentDate: serializeDateForApi(
                new Date().toISOString().slice(0, 10),
              ),
              proofUrl: storageRef,
              notes: 'Pago registrado al crear la orden manual desde dashboard.',
            }),
          },
        );

        const paymentBody = await paymentResponse.json().catch(() => null);
        if (!paymentResponse.ok) {
          throw new Error(
            extractApiErrorMessage(
              paymentBody,
              'No fue posible confirmar el pago del pedido.',
            ),
          );
        }

        setCreationNotice('El pedido quedo confirmado y el comprobante fue anexado.');
      } catch (postCreationError) {
        postCreationWarning =
          postCreationError instanceof Error
            ? postCreationError.message
            : 'El pedido se creo, pero no fue posible cerrar el registro del comprobante.';
      }

      setCreatedOrder(nextCreatedOrder);
      if (postCreationWarning) {
        setFormError(
          `${postCreationWarning} La orden quedo creada y requiere revision en el dashboard.`,
        );
      }
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

  const createCustomerMunicipalityOptions = useMemo(() =>
    createCustomerMunicipalities.map((m) => ({ value: m.id, label: m.name })),
  [createCustomerMunicipalities]);

  const shouldShowCustomerSearchDropdown =
    !selectedProfile && searchProfile.trim().length > 2;

  useEffect(() => {
    if (!showCreateCustomerModal || !createCustomerForm.departmentId) {
      setCreateCustomerMunicipalities([]);
      return;
    }

    const controller = new AbortController();

    const fetchCreateMunicipalities = async () => {
      try {
        const response = await apiFetch(
          `/locations/municipalities/${createCustomerForm.departmentId}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `No se pudieron cargar los municipios (${response.status}).`,
          );
        }

        const body: ApiResponse<LocationOption[]> = await response.json();
        setCreateCustomerMunicipalities(body.data || []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Error fetching municipalities for manual customer:', error);
        setCreateCustomerMunicipalities([]);
      }
    };

    void fetchCreateMunicipalities();

    return () => {
      controller.abort();
    };
  }, [createCustomerForm.departmentId, showCreateCustomerModal]);

  const closeCreateCustomerModal = useCallback((options?: { force?: boolean }) => {
    if (createCustomerSubmitting && !options?.force) {
      return;
    }

    setShowCreateCustomerModal(false);
    setCreateCustomerError(null);
    setCreateCustomerMunicipalities([]);
    setCreateCustomerForm(INITIAL_MANUAL_CUSTOMER_FORM);
  }, [createCustomerSubmitting]);

  const handleCreateCustomerFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const field = event.target.dataset.field || event.target.name;
    const { value } = event.target;
    setCreateCustomerForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateCustomerError(null);
    setCreateCustomerSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch('/users/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createCustomerForm.email.trim(),
          password: createCustomerForm.password,
          firstName: createCustomerForm.firstName.trim(),
          lastName: createCustomerForm.lastName.trim(),
          phone: createCustomerForm.phone.trim() || undefined,
          departmentId: createCustomerForm.departmentId || undefined,
          municipalityId: createCustomerForm.municipalityId || undefined,
          neighborhood: createCustomerForm.neighborhood.trim() || undefined,
          address: createCustomerForm.address.trim() || undefined,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(
            body,
            `No se pudo crear el cliente (${response.status}).`,
          ),
        );
      }

      const createdProfile = (
        body as ApiResponse<{ message: string; profile: Profile }>
      )?.data?.profile;

      if (!createdProfile) {
        throw new Error('El cliente se creo, pero la respuesta no devolvio el perfil.');
      }

      setProfiles((current) => {
        const withoutDuplicate = current.filter(
          (profile) => profile.id !== createdProfile.id,
        );
        return [createdProfile, ...withoutDuplicate];
      });
      handleSelectProfile(createdProfile);
      closeCreateCustomerModal({ force: true });
    } catch (error) {
      console.error('Error creating manual customer:', error);
      setCreateCustomerError(
        error instanceof Error
          ? error.message
          : 'No se pudo crear el cliente manualmente.',
      );
    } finally {
      setCreateCustomerSubmitting(false);
    }
  };

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
        {formError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        {creationNotice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {creationNotice}
          </div>
        )}
        <div className="grid gap-3">
          <button
            onClick={async () => {
              try {
                setFormError(null);
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
            const phone = getManualOrderContactPhone(
              shippingData.phone,
              selectedProfile?.phone,
            ).replace(/\D/g, '');
            const firstName = selectedProfile?.firstName || 'cliente';
            const message = `Hola ${firstName}. Adjunto el recibo de tu pedido #${createdOrder.orderNumber}. Gracias por tu compra en Tote Bag.`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
          }} className="rounded-2xl bg-emerald-500 p-4 font-black uppercase tracking-widest text-white transition-all hover:scale-[1.01] hover:bg-emerald-600">
            <span className="flex items-center justify-center gap-2.5"><WhatsAppIcon className="h-5 w-5 text-white" />Enviar por WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-theme bg-surface p-4 font-black uppercase tracking-widest text-primary transition-all hover:bg-base"
          >
            Crear Nuevo Pedido
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/orders')}
            className="rounded-2xl border border-theme bg-surface p-4 font-black uppercase tracking-widest text-primary transition-all hover:bg-base"
          >
            Volver a Pedidos
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
                  <input value={searchProfile} onChange={(event) => setSearchProfile(event.target.value)} placeholder="Buscar cliente por nombre, email o telefono..." className="w-full rounded-2xl border border-theme bg-base py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
                  {shouldShowCustomerSearchDropdown && (
                    <div className="absolute z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-theme bg-surface shadow-xl">
                      {customerSearchLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Buscando clientes...
                        </div>
                      ) : customerSearchError ? (
                        <div className="px-4 py-3 text-sm text-rose-600">
                          {customerSearchError}
                        </div>
                      ) : profiles.length > 0 ? (
                        profiles.map((profile) => (
                          <button key={profile.id} type="button" onClick={() => handleSelectProfile(profile)} className="flex w-full items-center justify-between border-b border-theme px-4 py-3 text-left hover:bg-primary/5 last:border-0">
                            <div>
                              <p className="text-sm font-bold text-primary">{profile.firstName || 'Sin nombre'} {profile.lastName || ''}</p>
                              <p className="text-[10px] text-muted">{profile.email}</p>
                              {profile.phone ? (
                                <p className="text-[10px] text-muted">{profile.phone}</p>
                              ) : null}
                            </div>
                            <Plus className="h-4 w-4 text-primary" />
                          </button>
                        ))
                      ) : hasCompletedCustomerSearch ? (
                        <div className="px-4 py-3 text-sm text-muted">
                          No se encontraron clientes.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateCustomerError(null);
                    setShowCreateCustomerModal(true);
                  }}
                  className="block w-full rounded-2xl border border-theme bg-primary/5 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-primary"
                >
                  Crear Nuevo Cliente
                </button>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-theme bg-surface p-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-primary">Productos</h2>
            {productsError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {productsError}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <select value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value); setSelectedVariantId(''); }} disabled={Boolean(productsError)} className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
                <option value="">Selecciona producto...</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} disabled={!selectedProduct || Boolean(productsError)} className="rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
                <option value="">Selecciona variante...</option>
                {selectedProduct?.variants.map((variant) => (
                  <option key={variant.id} value={variant.id} disabled={variant.stock <= 0}>
                    {[variant.size, variant.color, variant.sku].filter(Boolean).join(' | ')} | Stock {variant.stock}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={addItem} disabled={!selectedProduct || !selectedVariantId || Boolean(productsError)} className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-base-color disabled:opacity-50">
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
          <select
            value={initialStatus}
            onChange={(event) => {
              const nextStatus = event.target.value as 'PENDIENTE_PAGO' | 'PAGADA';
              setInitialStatus(nextStatus);
              if (nextStatus !== 'PAGADA') {
                setPaymentReceiptUrl('');
                setPaymentReceiptFile(null);
              }
            }}
            className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-black outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
            <option value="PAGADA">Pagada / Confirmada</option>
          </select>
          {initialStatus === 'PAGADA' && (
            <div className="space-y-3 rounded-2xl border border-theme bg-base/40 p-4">
              <ReceiptUpload
                entityId="manual-order-draft"
                entityType="order"
                deferUpload
                disabled={submitting}
                onFileSelected={setPaymentReceiptFile}
                selectedFileName={paymentReceiptFile?.name ?? null}
              />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  O pega una URL publica o referencia privada
                </p>
                <input
                  type="text"
                  value={paymentReceiptUrl}
                  onChange={(event) => setPaymentReceiptUrl(event.target.value)}
                  placeholder="https://... o private://..."
                  className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted">
                Si adjuntas un archivo, el pedido se crea y luego se confirma con el comprobante.
              </p>
            </div>
          )}
          <button disabled={submitting} onClick={handleSubmit} className="w-full rounded-2xl bg-primary py-4 font-black uppercase tracking-[0.2em] text-base-color disabled:opacity-50">
            {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Creando...</span> : 'Crear Pedido'}
          </button>
        </aside>
      </div>

      {showCreateCustomerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => closeCreateCustomerModal()}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-theme px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">Cliente nuevo</p>
                <h2 className="mt-1 text-2xl font-black text-primary">Crear cliente para este pedido</h2>
                <p className="mt-1 text-sm text-muted">El cliente se crea dentro del dashboard y queda listo para seleccionarlo en la orden manual.</p>
              </div>
              <button
                type="button"
                onClick={() => closeCreateCustomerModal()}
                className="rounded-full p-2 text-muted transition-colors hover:bg-base hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateCustomer}
              autoComplete="off"
              className="space-y-6 px-6 py-6"
            >
              {createCustomerError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createCustomerError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="customerFirstName"
                  data-field="firstName"
                  value={createCustomerForm.firstName}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Nombre"
                  autoComplete="off"
                  required
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  name="customerLastName"
                  data-field="lastName"
                  value={createCustomerForm.lastName}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Apellido"
                  autoComplete="off"
                  required
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  name="customerEmail"
                  data-field="email"
                  type="email"
                  value={createCustomerForm.email}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Correo electronico"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  name="customerPassword"
                  data-field="password"
                  type="password"
                  value={createCustomerForm.password}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Contrasena temporal"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  minLength={6}
                  required
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  name="customerPhone"
                  data-field="phone"
                  value={createCustomerForm.phone}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Telefono"
                  autoComplete="off"
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="px-1 text-[10px] font-black uppercase text-muted">Departamento</p>
                  <Combobox
                    options={departmentOptions}
                    value={createCustomerForm.departmentId}
                    onChange={(id) => {
                      setCreateCustomerForm((current) => ({
                        ...current,
                        departmentId: id,
                        municipalityId: '',
                      }));
                    }}
                    placeholder="Seleccionar departamento..."
                    searchPlaceholder="Buscar departamento..."
                  />
                </div>
                <div className="space-y-1">
                  <p className="px-1 text-[10px] font-black uppercase text-muted">Ciudad o municipio</p>
                  <Combobox
                    options={createCustomerMunicipalityOptions}
                    value={createCustomerForm.municipalityId}
                    onChange={(id) => {
                      setCreateCustomerForm((current) => ({
                        ...current,
                        municipalityId: id,
                      }));
                    }}
                    placeholder="Seleccionar municipio..."
                    searchPlaceholder="Buscar municipio..."
                    disabled={!createCustomerForm.departmentId}
                    emptyMessage="No hay resultados."
                  />
                </div>
                <input
                  name="customerNeighborhood"
                  data-field="neighborhood"
                  value={createCustomerForm.neighborhood}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Barrio"
                  autoComplete="off"
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <textarea
                  name="customerAddress"
                  data-field="address"
                  value={createCustomerForm.address}
                  onChange={handleCreateCustomerFormChange}
                  placeholder="Direccion"
                  autoComplete="off"
                  rows={3}
                  className="rounded-2xl border border-theme bg-base px-4 py-3 font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20 md:col-span-2"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => closeCreateCustomerModal()}
                  className="rounded-2xl border border-theme px-5 py-3 text-sm font-bold text-muted transition-colors hover:bg-base"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCustomerSubmitting}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-base-color transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createCustomerSubmitting ? 'Creando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
