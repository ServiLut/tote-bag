'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  Paperclip,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@tote-bag/ui';
import { CreatableCombobox } from '@/components/ui/CreatableCombobox';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
  parseLocalizedNumber,
} from '@/lib/numeric-input';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { notifyFinanceDataChanged } from '@/lib/finance-events';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

type ItemType = 'VARIANT' | 'SUPPLY' | 'TOOL' | 'OTHER';
type BatchInputStatus = 'RECIBIDO' | 'PENDIENTE';
type PurchaseDocumentType = 'INVOICE' | 'DELIVERY_NOTE';

interface Supplier {
  id: string;
  name: string;
  nit?: string | null;
}

interface ReceivableVariant {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  costPrice?: number | null;
  stock?: number | null;
  productId: string;
}

interface ReceivableProduct {
  id: string;
  name: string;
  variants?: ReceivableVariant[];
}

interface VariantOption {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  label: string;
  costPrice: number;
  stock: number;
}

interface SupplyItem {
  id: string;
  name: string;
  sku?: string | null;
  category: string;
  unitOfMeasure: string;
  cost: number;
  stock: number;
  minStock?: number | null;
}

interface ComboboxOption {
  value: string;
  label: string;
}

interface PurchaseBatchLine {
  id: string;
  itemType: ItemType;
  variantId?: string | null;
  supplyItemId?: string | null;
  itemName?: string | null;
  description?: string | null;
  quantity: number;
  quantityRemaining: number;
  unitOfMeasure: string;
  unitCost: number;
  lineTotal: number;
  status: string;
  notes?: string | null;
  variant?: ReceivableVariant | null;
  supplyItem?: SupplyItem | null;
}

interface PurchaseBatch {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  supplierId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  status: string;
  documentType?: PurchaseDocumentType | null;
  supportUrl?: string | null;
  paymentReceiptUrl?: string | null;
  createdAt: string;
  product?: { name: string } | null;
  variant?: ReceivableVariant | null;
  supplier?: { name: string } | null;
  lines?: PurchaseBatchLine[];
}

interface LineForm {
  id: string;
  itemType: ItemType;
  variantId: string;
  supplyItemId: string;
  itemName: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitCostInput: string;
  unitCost: number;
  notes: string;
}

interface ReceptionForm {
  supplierId: string;
  freightCostInput: string;
  freightCost: number;
  status: BatchInputStatus;
  documentType: PurchaseDocumentType;
  purchaseDate: string;
  lines: LineForm[];
}

interface SupplyForm {
  name: string;
  sku: string;
  category: string;
  unitOfMeasure: string;
  costInput: string;
  cost: number;
  minStock: string;
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  VARIANT: 'Producto vendible',
  SUPPLY: 'Insumo / empaque',
  TOOL: 'Herramienta / utensilio',
  OTHER: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'Recibido',
  PENDING: 'Pendiente',
  DEPLETED: 'Agotado',
};

const DOCUMENT_TYPE_LABELS: Record<PurchaseDocumentType, string> = {
  INVOICE: 'Factura',
  DELIVERY_NOTE: 'Remision',
};

const UNIT_OPTIONS = ['und', 'kg', 'g', 'm', 'cm', 'lt', 'ml', 'caja', 'rollo'];

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function createEmptyLine(itemType: ItemType = 'VARIANT'): LineForm {
  return {
    id: crypto.randomUUID(),
    itemType,
    variantId: '',
    supplyItemId: '',
    itemName: '',
    description: '',
    quantity: '1',
    unitOfMeasure: 'und',
    unitCostInput: '',
    unitCost: 0,
    notes: '',
  };
}

function createEmptyForm(): ReceptionForm {
  return {
    supplierId: '',
    freightCostInput: '',
    freightCost: 0,
    status: 'RECIBIDO',
    documentType: 'INVOICE',
    purchaseDate: getToday(),
    lines: [createEmptyLine()],
  };
}

function createEmptySupplyForm(): SupplyForm {
  return {
    name: '',
    sku: '',
    category: 'Empaque',
    unitOfMeasure: 'und',
    costInput: '',
    cost: 0,
    minStock: '',
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatQuantity(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(value) ? value : 0);

  return unit ? `${formatted} ${unit}` : formatted;
}

function parseQuantity(value: string) {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeQuantityInput(value: string) {
  return value.replace(/[^\d.,]/g, '');
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

function getApiEntity<T>(body: unknown): T | null {
  if (isRecord(body) && isRecord(body.data)) {
    return body.data as T;
  }

  if (isRecord(body)) {
    return body as T;
  }

  return null;
}

export default function BatchReceptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useDashboardAuth();
  const supabase = createClient();

  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<ReceivableProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [openingSupportId, setOpeningSupportId] = useState<string | null>(null);
  const [creatingSupply, setCreatingSupply] = useState(false);
  const [creatingSupplyForLine, setCreatingSupplyForLine] = useState<
    string | null
  >(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [entryDateFilter, setEntryDateFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ReceptionForm>(createEmptyForm);
  const [supplyForm, setSupplyForm] =
    useState<SupplyForm>(createEmptySupplyForm);

  const variantOptions = useMemo<VariantOption[]>(() => {
    return products.flatMap((product) =>
      (product.variants || []).map((variant) => {
        const details = [variant.size, variant.color]
          .filter(Boolean)
          .join(' / ');

        return {
          id: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          label: `${product.name}${details ? ` - ${details}` : ''} (${variant.sku})`,
          costPrice: Number(variant.costPrice || 0),
          stock: Number(variant.stock || 0),
        };
      }),
    );
  }, [products]);

  const variantById = useMemo(() => {
    return new Map(variantOptions.map((variant) => [variant.id, variant]));
  }, [variantOptions]);

  const supplyById = useMemo(() => {
    return new Map(supplyItems.map((item) => [item.id, item]));
  }, [supplyItems]);

  const supplyOptions = useMemo<ComboboxOption[]>(() => {
    return supplyItems.map((item) => ({
      value: item.id,
      label: `${item.name}${item.sku ? ` (${item.sku})` : ''}`,
    }));
  }, [supplyItems]);

  const subtotal = useMemo(() => {
    return formData.lines.reduce((total, line) => {
      return total + parseQuantity(line.quantity) * line.unitCost;
    }, 0);
  }, [formData.lines]);

  const projectedTotal = subtotal + formData.freightCost;

  const getAuthHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? accessToken;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [accessToken, supabase.auth]);

  const resolveApiErrorMessage = useCallback(
    async (
      res: Response,
      fallbackMessage: string,
      options?: { redirectOnUnauthorized?: boolean; forbiddenMessage?: string },
    ) => {
      if (res.status === 401) {
        if (options?.redirectOnUnauthorized) {
          router.push(
            `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
          );
        }

        return 'Tu sesion expiro. Inicia sesion nuevamente.';
      }

      if (res.status === 403) {
        return (
          options?.forbiddenMessage ||
          'No tienes permisos para gestionar recepcion de abastecimiento.'
        );
      }

      const body: unknown = await res.json().catch(() => null);

      if (isRecord(body)) {
        const message = body.message;

        if (typeof message === 'string' && message.trim()) {
          return message;
        }

        if (Array.isArray(message)) {
          const firstMessage = message.find(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
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

  const fetchData = useCallback(async () => {
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const [batchesRes, variantsRes, suppliersRes, supplyRes] =
        await Promise.all([
          apiFetch('/inventory/batches', { headers: authHeaders }),
          apiFetch('/inventory/receivable-variants', { headers: authHeaders }),
          apiFetch('/inventory/suppliers', { headers: authHeaders }),
          apiFetch('/inventory/supply-items', { headers: authHeaders }),
        ]);

      if (!batchesRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            batchesRes,
            'No fue posible cargar las recepciones.',
            { redirectOnUnauthorized: true },
          ),
        );
      }

      if (!variantsRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            variantsRes,
            'No fue posible cargar el catalogo vendible.',
          ),
        );
      }

      if (!suppliersRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            suppliersRes,
            'No fue posible cargar los proveedores.',
          ),
        );
      }

      if (!supplyRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            supplyRes,
            'No fue posible cargar los insumos.',
          ),
        );
      }

      const [batchesBody, variantsBody, suppliersBody, supplyBody] =
        await Promise.all([
          batchesRes.json() as Promise<unknown>,
          variantsRes.json() as Promise<unknown>,
          suppliersRes.json() as Promise<unknown>,
          supplyRes.json() as Promise<unknown>,
        ]);

      setBatches(getApiList<PurchaseBatch>(batchesBody));
      setProducts(getApiList<ReceivableProduct>(variantsBody));
      setSuppliers(getApiList<Supplier>(suppliersBody));
      setSupplyItems(getApiList<SupplyItem>(supplyBody));
    } catch (err) {
      console.error('Error fetching reception data:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Error cargando la recepcion de abastecimiento.',
      );
      setBatches([]);
      setProducts([]);
      setSuppliers([]);
      setSupplyItems([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, resolveApiErrorMessage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const skuSearch = searchParams.get('search');

    if (skuSearch) {
      setSearch(skuSearch);
    }
  }, [searchParams]);

  const updateLine = useCallback(
    (lineId: string, updates: Partial<LineForm>) => {
      setFormData((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId ? { ...line, ...updates } : line,
        ),
      }));
    },
    [],
  );

  const handleLineTypeChange = useCallback(
    (lineId: string, itemType: ItemType) => {
      updateLine(lineId, {
        itemType,
        variantId: '',
        supplyItemId: '',
        itemName: '',
        description: '',
        unitOfMeasure: 'und',
        unitCostInput: '',
        unitCost: 0,
      });
    },
    [updateLine],
  );

  const handleVariantChange = useCallback(
    (lineId: string, variantId: string) => {
      const option = variantById.get(variantId);
      const costState = createCurrencyInputState(option?.costPrice ?? 0);

      updateLine(lineId, {
        variantId,
        unitOfMeasure: 'und',
        unitCostInput: costState.formattedValue,
        unitCost: costState.numericValue,
      });
    },
    [updateLine, variantById],
  );

  const handleSupplyChange = useCallback(
    (lineId: string, supplyItemId: string) => {
      const supplyItem = supplyById.get(supplyItemId);
      const costState = createCurrencyInputState(supplyItem?.cost ?? 0);

      updateLine(lineId, {
        supplyItemId,
        unitOfMeasure: supplyItem?.unitOfMeasure || 'und',
        unitCostInput: costState.formattedValue,
        unitCost: costState.numericValue,
      });
    },
    [supplyById, updateLine],
  );

  const handleCreateSupplyFromCombobox = useCallback(
    async (lineId: string, label: string) => {
      const name = label.trim();

      if (!name) {
        return;
      }

      setCreatingSupply(true);
      setCreatingSupplyForLine(lineId);
      setError(null);

      try {
        const authHeaders = await getAuthHeaders();
        const res = await apiFetch('/inventory/supply-items', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            category: 'Empaque',
            unitOfMeasure: 'und',
            cost: 0,
            stock: 0,
          }),
        });

        if (!res.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              res,
              'No fue posible crear el insumo.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        const body: unknown = await res.json();
        const created = getApiEntity<SupplyItem>(body);

        if (!created) {
          throw new Error('La API no retorno el insumo creado.');
        }

        const costState = createCurrencyInputState(created.cost);
        setSupplyItems((prev) => [...prev, created]);
        updateLine(lineId, {
          itemType: 'SUPPLY',
          supplyItemId: created.id,
          unitOfMeasure: created.unitOfMeasure,
          unitCostInput: costState.formattedValue,
          unitCost: costState.numericValue,
        });
      } catch (err) {
        console.error('Error creating supply item from combobox:', err);
        setError(
          err instanceof Error ? err.message : 'No fue posible crear el insumo.',
        );
        throw err;
      } finally {
        setCreatingSupply(false);
        setCreatingSupplyForLine(null);
      }
    },
    [getAuthHeaders, resolveApiErrorMessage, updateLine],
  );

  const addLine = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setFormData((prev) => ({
      ...prev,
      lines:
        prev.lines.length === 1
          ? prev.lines
          : prev.lines.filter((line) => line.id !== lineId),
    }));
  }, []);

  const closeCreateModal = useCallback(() => {
    if (submitting) {
      return;
    }

    setIsModalOpen(false);
    setError(null);
    setFormData(createEmptyForm());
    setSupportFile(null);
  }, [submitting]);

  const validateForm = useCallback(() => {
    if (!formData.supplierId) {
      return 'Selecciona un proveedor.';
    }

    if (!formData.purchaseDate) {
      return 'Selecciona la fecha de recepcion.';
    }

    if (!supportFile) {
      return 'Adjunta el soporte PDF/JPG del proveedor.';
    }

    if (
      supportFile.type !== 'application/pdf' &&
      supportFile.type !== 'image/jpeg'
    ) {
      return 'El soporte del proveedor debe ser PDF o JPG.';
    }

    if (formData.lines.length === 0) {
      return 'Agrega al menos una linea al lote.';
    }

    for (const [index, line] of formData.lines.entries()) {
      const lineNumber = index + 1;
      const quantity = parseQuantity(line.quantity);

      if (quantity <= 0) {
        return `La linea ${lineNumber} debe tener una cantidad mayor a cero.`;
      }

      if (!line.unitOfMeasure.trim()) {
        return `La linea ${lineNumber} debe tener unidad de medida.`;
      }

      if (line.unitCost < 0) {
        return `La linea ${lineNumber} no puede tener costo negativo.`;
      }

      if (line.itemType === 'VARIANT') {
        if (!line.variantId) {
          return `La linea ${lineNumber} requiere una variante.`;
        }

        if (!Number.isInteger(quantity)) {
          return `La linea ${lineNumber} es producto vendible y requiere cantidad entera.`;
        }
      }

      if (line.itemType === 'SUPPLY' && !line.supplyItemId) {
        return `La linea ${lineNumber} requiere un insumo o empaque.`;
      }

      if (
        (line.itemType === 'TOOL' || line.itemType === 'OTHER') &&
        !line.itemName.trim() &&
        !line.description.trim()
      ) {
        return `La linea ${lineNumber} requiere nombre o descripcion.`;
      }
    }

    if (subtotal <= 0) {
      return 'El subtotal del lote debe ser mayor a cero.';
    }

    return null;
  }, [formData, subtotal, supportFile]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      setSubmitting(true);

      try {
        const authHeaders = await getAuthHeaders();
        const payload = {
          supplierId: formData.supplierId,
          totalCost: subtotal,
          freightCost: formData.freightCost,
          status: formData.status,
          documentType: formData.documentType,
          purchaseDate: formData.purchaseDate,
          items: formData.lines.map((line) => {
            const variant = variantById.get(line.variantId);

            return {
              itemType: line.itemType,
              productId:
                line.itemType === 'VARIANT' ? variant?.productId : undefined,
              variantId:
                line.itemType === 'VARIANT' ? line.variantId : undefined,
              supplyItemId:
                line.itemType === 'SUPPLY' ? line.supplyItemId : undefined,
              itemName:
                line.itemType === 'TOOL' || line.itemType === 'OTHER'
                  ? line.itemName.trim()
                  : undefined,
              description: line.description.trim() || undefined,
              cantidad: parseQuantity(line.quantity),
              unitOfMeasure: line.unitOfMeasure.trim(),
              costoUnitario: line.unitCost,
              notes: line.notes.trim() || undefined,
            };
          }),
        };

        const requestBody = new FormData();
        requestBody.append('payload', JSON.stringify(payload));
        requestBody.append('support', supportFile!);

        const res = await apiFetch('/inventory/batches/with-support', {
          method: 'POST',
          headers: authHeaders,
          body: requestBody,
        });

        if (!res.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              res,
              'No fue posible registrar la recepcion.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        setIsModalOpen(false);
        setFormData(createEmptyForm());
        setSupportFile(null);
        await fetchData();
        notifyFinanceDataChanged();
      } catch (err) {
        console.error('Error creating reception batch:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'No fue posible registrar la recepcion.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      fetchData,
      formData,
      getAuthHeaders,
      resolveApiErrorMessage,
      supportFile,
      subtotal,
      validateForm,
      variantById,
    ],
  );

  const openBatchSupport = useCallback(
    async (batch: PurchaseBatch) => {
      setOpeningSupportId(batch.id);
      setError(null);

      try {
        const authHeaders = await getAuthHeaders();
        const response = await apiFetch(
          `/payments/supports/batch/${batch.id}/signed-url`,
          { headers: authHeaders },
        );

        if (!response.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              response,
              'No fue posible abrir el soporte.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        const body: unknown = await response.json();
        const signedUrl =
          isRecord(body) && typeof body.signedUrl === 'string'
            ? body.signedUrl
            : isRecord(body) &&
                isRecord(body.data) &&
                typeof body.data.signedUrl === 'string'
              ? body.data.signedUrl
              : null;

        if (!signedUrl) {
          throw new Error('La API no retorno una URL firmada valida.');
        }

        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Error opening batch support:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'No fue posible abrir el soporte.',
        );
      } finally {
        setOpeningSupportId(null);
      }
    },
    [getAuthHeaders, resolveApiErrorMessage],
  );

  const handleCreateSupply = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (!supplyForm.name.trim()) {
        setError('El insumo requiere nombre.');
        return;
      }

      if (!supplyForm.category.trim()) {
        setError('El insumo requiere categoria.');
        return;
      }

      if (!supplyForm.unitOfMeasure.trim()) {
        setError('El insumo requiere unidad de medida.');
        return;
      }

      setCreatingSupply(true);

      try {
        const authHeaders = await getAuthHeaders();
        const res = await apiFetch('/inventory/supply-items', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: supplyForm.name.trim(),
            sku: supplyForm.sku.trim() || undefined,
            category: supplyForm.category.trim(),
            unitOfMeasure: supplyForm.unitOfMeasure.trim(),
            cost: supplyForm.cost,
            minStock: supplyForm.minStock
              ? parseQuantity(supplyForm.minStock)
              : undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              res,
              'No fue posible crear el insumo.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        const body: unknown = await res.json();
        const created = getApiEntity<SupplyItem>(body);

        if (!created) {
          throw new Error('La API no retorno el insumo creado.');
        }

        setSupplyItems((prev) => [...prev, created]);

        if (creatingSupplyForLine) {
          const costState = createCurrencyInputState(created.cost);
          updateLine(creatingSupplyForLine, {
            itemType: 'SUPPLY',
            supplyItemId: created.id,
            unitOfMeasure: created.unitOfMeasure,
            unitCostInput: costState.formattedValue,
            unitCost: costState.numericValue,
          });
        }

        setSupplyForm(createEmptySupplyForm());
        setIsSupplyModalOpen(false);
        setCreatingSupplyForLine(null);
      } catch (err) {
        console.error('Error creating supply item:', err);
        setError(
          err instanceof Error ? err.message : 'No fue posible crear el insumo.',
        );
      } finally {
        setCreatingSupply(false);
      }
    },
    [
      creatingSupplyForLine,
      getAuthHeaders,
      resolveApiErrorMessage,
      supplyForm,
      updateLine,
    ],
  );

  const getDisplayLines = useCallback((batch: PurchaseBatch) => {
    if (batch.lines?.length) {
      return batch.lines;
    }

    return [
      {
        id: `${batch.id}-legacy`,
        itemType: 'VARIANT' as ItemType,
        variantId: batch.variantId,
        supplyItemId: null,
        itemName: batch.product?.name || 'Producto vendible',
        description: null,
        quantity: batch.quantityReceived,
        quantityRemaining: batch.quantityRemaining,
        unitOfMeasure: 'und',
        unitCost: batch.unitCost,
        lineTotal: batch.totalCost,
        status: batch.status,
        variant: batch.variant,
        supplyItem: null,
      },
    ];
  }, []);

  const getLineDisplayName = useCallback(
    (line: PurchaseBatchLine) => {
      if (line.itemType === 'VARIANT') {
        const option = line.variantId ? variantById.get(line.variantId) : null;
        const variantText = line.variant?.sku ? ` (${line.variant.sku})` : '';
        return option?.label || `${line.itemName || 'Producto'}${variantText}`;
      }

      if (line.itemType === 'SUPPLY') {
        return line.supplyItem?.name || line.itemName || 'Insumo / empaque';
      }

      return line.itemName || line.description || ITEM_TYPE_LABELS[line.itemType];
    },
    [variantById],
  );

  const canDeleteBatch = useCallback(
    (batch: PurchaseBatch) => {
      if (batch.status === 'PENDING') {
        return true;
      }

      return getDisplayLines(batch).every(
        (line) => line.quantityRemaining === line.quantity,
      );
    },
    [getDisplayLines],
  );

  const handleDelete = useCallback(
    async (batch: PurchaseBatch) => {
      if (!canDeleteBatch(batch)) {
        setError(
          'No se puede eliminar una recepcion con consumo o movimientos aplicados.',
        );
        return;
      }

      const shouldDelete = window.confirm(
        'Eliminar esta recepcion revertira el stock recibido cuando aplique. Deseas continuar?',
      );

      if (!shouldDelete) {
        return;
      }

      setDeletingBatchId(batch.id);
      setError(null);

      try {
        const authHeaders = await getAuthHeaders();
        const response = await apiFetch(`/inventory/batches/${batch.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        if (!response.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              response,
              'No fue posible eliminar la recepcion.',
              { redirectOnUnauthorized: true },
            ),
          );
        }

        await fetchData();
        notifyFinanceDataChanged();
      } catch (err) {
        console.error('Error deleting reception batch:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'No fue posible eliminar la recepcion.',
        );
      } finally {
        setDeletingBatchId(null);
      }
    },
    [canDeleteBatch, fetchData, getAuthHeaders, resolveApiErrorMessage],
  );

  const filteredBatches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const lines = getDisplayLines(batch);
      const supplierName = batch.supplier?.name || '';
      const searchable = [
        batch.id,
        supplierName,
        STATUS_LABELS[batch.status] || batch.status,
        ...lines.flatMap((line) => [
          ITEM_TYPE_LABELS[line.itemType],
          getLineDisplayName(line),
          line.variant?.sku || '',
          line.supplyItem?.sku || '',
          line.description || '',
        ]),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'all' || batch.status === statusFilter;
      const matchesType =
        typeFilter === 'all' ||
        lines.some((line) => line.itemType === typeFilter);
      const matchesDate =
        !entryDateFilter ||
        new Date(batch.createdAt).toISOString().split('T')[0] ===
          entryDateFilter;

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [
    batches,
    entryDateFilter,
    getDisplayLines,
    getLineDisplayName,
    search,
    statusFilter,
    typeFilter,
  ]);

  const metricTotals = useMemo(() => {
    return batches.reduce(
      (acc, batch) => {
        const lines = getDisplayLines(batch);
        acc.totalCost += batch.totalCost;
        acc.lines += lines.length;
        acc.supplyLines += lines.filter(
          (line) => line.itemType === 'SUPPLY',
        ).length;
        acc.operationalLines += lines.filter(
          (line) => line.itemType === 'TOOL' || line.itemType === 'OTHER',
        ).length;
        return acc;
      },
      {
        totalCost: 0,
        lines: 0,
        supplyLines: 0,
        operationalLines: 0,
      },
    );
  }, [batches, getDisplayLines]);

  const lineErrors = useMemo(() => {
    return new Map(
      formData.lines.map((line) => {
        const quantity = parseQuantity(line.quantity);
        let message = '';

        if (quantity <= 0) {
          message = 'Cantidad requerida';
        } else if (line.itemType === 'VARIANT' && !line.variantId) {
          message = 'Selecciona una variante';
        } else if (
          line.itemType === 'VARIANT' &&
          !Number.isInteger(quantity)
        ) {
          message = 'La cantidad debe ser entera';
        } else if (line.itemType === 'SUPPLY' && !line.supplyItemId) {
          message = 'Selecciona un insumo';
        } else if (
          (line.itemType === 'TOOL' || line.itemType === 'OTHER') &&
          !line.itemName.trim() &&
          !line.description.trim()
        ) {
          message = 'Nombre o descripcion requerido';
        }

        return [line.id, message];
      }),
    );
  }, [formData.lines]);

  return (
    <div className="mx-auto max-w-7xl animate-in space-y-8 p-8 duration-500 fade-in slide-in-from-bottom-4 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
              <Truck className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Recepcion de Abastecimiento
            </h1>
          </div>
          <p className="font-medium text-muted">
            Registra productos vendibles, insumos, empaques, herramientas y
            otros ingresos operativos en un mismo lote.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setFormData(createEmptyForm());
            setSupportFile(null);
            setError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nuevo ingreso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ReceptionMetricCard
          label="Recepciones"
          value={String(batches.length)}
          detail={`${filteredBatches.length} visibles con filtros`}
          icon={<Database className="h-5 w-5" />}
        />
        <ReceptionMetricCard
          label="Lineas registradas"
          value={String(metricTotals.lines)}
          detail="Items recibidos por lote"
          icon={<Package className="h-5 w-5" />}
        />
        <ReceptionMetricCard
          label="Insumos / operacion"
          value={String(metricTotals.supplyLines + metricTotals.operationalLines)}
          detail={`${metricTotals.supplyLines} insumos y ${metricTotals.operationalLines} operativos`}
          icon={<Truck className="h-5 w-5" />}
        />
        <ReceptionMetricCard
          label="Valor recibido"
          value={formatCurrency(metricTotals.totalCost)}
          detail="Costo registrado en abastecimiento"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="border-b border-theme bg-base/30 p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_170px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por proveedor, SKU, insumo o descripcion"
                className="w-full rounded-xl border border-theme bg-base py-2.5 pl-10 pr-4 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-black text-primary outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Todos los estados</option>
              <option value="IN_STOCK">Recibidos</option>
              <option value="PENDING">Pendientes</option>
              <option value="DEPLETED">Agotados</option>
            </Select>
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ItemType)}
              className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-black text-primary outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Todos los tipos</option>
              <option value="VARIANT">Producto vendible</option>
              <option value="SUPPLY">Insumo / empaque</option>
              <option value="TOOL">Herramienta</option>
              <option value="OTHER">Otro</option>
            </Select>
            <Input
              type="date"
              value={entryDateFilter}
              onChange={(event) => setEntryDateFilter(event.target.value)}
              className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-black text-primary outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-8 py-14 text-center">
            <div className="rounded-full bg-base p-4">
              <Database className="h-8 w-8 text-muted" />
            </div>
            <h2 className="mt-3 text-lg font-black text-primary">
              Sin recepciones
            </h2>
            <p className="mt-1 max-w-md text-sm font-bold text-muted">
              Crea un ingreso de abastecimiento para registrar inventario
              vendible u operativo.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-theme">
            {filteredBatches.map((batch) => {
              const lines = getDisplayLines(batch);
              const expanded = expandedBatchId === batch.id;
              const lineTypes = Array.from(
                new Set(lines.map((line) => ITEM_TYPE_LABELS[line.itemType])),
              ).join(', ');

              return (
                <div
                  key={batch.id}
                  className="px-8 py-5 transition-colors hover:bg-primary/5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBatchId(expanded ? null : batch.id)
                      }
                      className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    >
                      <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-theme bg-base text-muted">
                        <ChevronDown
                          className={`h-4 w-4 transition ${
                            expanded ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-primary">
                            {batch.supplier?.name || 'Proveedor sin nombre'}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                            {STATUS_LABELS[batch.status] || batch.status}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-base px-3 py-1 text-[10px] font-black uppercase tracking-wider text-muted">
                            {DOCUMENT_TYPE_LABELS[
                              batch.documentType || 'INVOICE'
                            ] || 'Factura'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-muted">
                          {new Date(batch.createdAt).toLocaleDateString(
                            'es-CO',
                          )}{' '}
                          - {lines.length} linea
                          {lines.length === 1 ? '' : 's'} - {lineTypes}
                        </p>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                      {(batch.supportUrl || batch.paymentReceiptUrl) && (
                        <Button
                          type="button"
                          disabled={openingSupportId === batch.id}
                          onClick={() => void openBatchSupport(batch)}
                          className="inline-flex items-center gap-2 rounded-xl border border-theme bg-base px-4 py-2 text-xs font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
                        >
                          {openingSupportId === batch.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Paperclip className="h-4 w-4" />
                          )}
                          Soporte
                        </Button>
                      )}
                      <div className="text-left lg:text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                          Total
                        </p>
                        <p className="font-black text-primary">
                          {formatCurrency(batch.totalCost)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        disabled={
                          deletingBatchId === batch.id || !canDeleteBatch(batch)
                        }
                        onClick={() => void handleDelete(batch)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingBatchId === batch.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="mt-4 overflow-x-auto rounded-2xl border border-theme bg-surface">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[1.2fr_150px_120px_140px_140px] gap-3 border-b border-theme bg-base/50 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted/60">
                          <span>Item</span>
                          <span>Tipo</span>
                          <span>Cantidad</span>
                          <span>Costo unitario</span>
                          <span>Subtotal</span>
                        </div>
                        <div className="divide-y divide-theme">
                          {lines.map((line) => (
                            <div
                              key={line.id}
                              className="grid grid-cols-[1.2fr_150px_120px_140px_140px] gap-3 px-6 py-4 text-sm transition-colors hover:bg-base/30"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-bold text-primary">
                                  {getLineDisplayName(line)}
                                </p>
                                {(line.description || line.notes) && (
                                  <p className="mt-1 truncate text-xs font-medium text-muted">
                                    {line.description || line.notes}
                                  </p>
                                )}
                              </div>
                              <span className="font-medium text-muted">
                                {ITEM_TYPE_LABELS[line.itemType]}
                              </span>
                              <span className="font-medium text-muted">
                                {formatQuantity(
                                  line.quantity,
                                  line.unitOfMeasure,
                                )}
                              </span>
                              <span className="font-medium text-muted">
                                {formatCurrency(line.unitCost)}
                              </span>
                              <span className="font-black text-primary">
                                {formatCurrency(line.lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary/20 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-6xl rounded-3xl border border-theme bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-theme p-8">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  Nuevo ingreso de abastecimiento
                </h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  Usa lineas separadas para controlar que solo los productos
                  vendibles afecten stock comercial.
                </p>
              </div>
              <Button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-8">
              <div className="grid gap-4 md:grid-cols-5">
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Proveedor
                  </span>
                  <Select
                    value={formData.supplierId}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        supplierId: event.target.value,
                      }))
                    }
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    <option value="">Selecciona proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Fecha
                  </span>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        purchaseDate: event.target.value,
                      }))
                    }
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Estado
                  </span>
                  <Select
                    value={formData.status}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: event.target.value as BatchInputStatus,
                      }))
                    }
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    <option value="RECIBIDO">Recibido</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </Select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Documento
                  </span>
                  <Select
                    value={formData.documentType}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        documentType: event.target
                          .value as PurchaseDocumentType,
                      }))
                    }
                    disabled={submitting}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    <option value="INVOICE">Factura</option>
                    <option value="DELIVERY_NOTE">Remision</option>
                  </Select>
                </label>
              </div>

              <label className="block rounded-xl border border-dashed border-theme bg-base/40 p-4">
                <span className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
                  <Paperclip className="h-4 w-4" />
                  Soporte del proveedor
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                  disabled={submitting}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSupportFile(file);
                  }}
                  className="mt-2 block w-full text-sm font-bold text-primary file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-black file:text-base-color disabled:opacity-60"
                />
                <p className="mt-2 text-xs font-medium text-muted">
                  Obligatorio para ingresar stock o abastecimiento. Se almacena
                  como soporte privado ligado al lote.
                </p>
                {supportFile ? (
                  <p className="mt-1 text-xs font-black text-primary">
                    {supportFile.name}
                  </p>
                ) : null}
              </label>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold text-primary">
                      Lineas del lote
                    </h3>
                    <p className="text-sm font-medium text-muted">
                      Cada linea define su tipo y su impacto operativo.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={addLine}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar linea
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.lines.map((line, index) => {
                    const lineTotal =
                      parseQuantity(line.quantity) * line.unitCost;
                    const lineError = lineErrors.get(line.id);

                    return (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-theme bg-base/40 p-5"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-primary">
                              Linea {index + 1}
                            </p>
                            {lineError && (
                              <p className="mt-1 text-xs font-bold text-rose-600">
                                {lineError}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            disabled={submitting || formData.lines.length === 1}
                            className="rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-12">
                          <label className="lg:col-span-3">
                            <span className="mb-1 block text-sm font-medium text-primary">
                              Tipo de item
                            </span>
                            <Select
                              value={line.itemType}
                              onChange={(event) =>
                                handleLineTypeChange(
                                  line.id,
                                  event.target.value as ItemType,
                                )
                              }
                              disabled={submitting}
                              className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                            >
                              <option value="VARIANT">Producto vendible</option>
                              <option value="SUPPLY">Insumo / empaque</option>
                              <option value="TOOL">
                                Herramienta / utensilio
                              </option>
                              <option value="OTHER">Otro</option>
                            </Select>
                          </label>

                          {line.itemType === 'VARIANT' && (
                            <label className="lg:col-span-5">
                              <span className="mb-1 block text-sm font-medium text-primary">
                                Variante
                              </span>
                              <Select
                                value={line.variantId}
                                onChange={(event) =>
                                  handleVariantChange(
                                    line.id,
                                    event.target.value,
                                  )
                                }
                                disabled={submitting}
                                className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                              >
                                <option value="">Selecciona variante</option>
                                {variantOptions.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {variant.label}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          )}

                          {line.itemType === 'SUPPLY' && (
                            <div className="lg:col-span-5">
                              <span className="mb-1 block text-sm font-medium text-primary">
                                Insumo o empaque
                              </span>
                              <CreatableCombobox
                                options={supplyOptions}
                                value={line.supplyItemId}
                                onChange={(value) =>
                                  handleSupplyChange(line.id, value)
                                }
                                onCreate={(label) =>
                                  handleCreateSupplyFromCombobox(
                                    line.id,
                                    label,
                                  )
                                }
                                placeholder="Selecciona o crea un insumo"
                                searchPlaceholder="Buscar o escribir nuevo insumo..."
                                emptyMessage="Escribe un nombre para crear un insumo."
                                disabled={submitting}
                                isLoading={
                                  creatingSupply &&
                                  creatingSupplyForLine === line.id
                                }
                              />
                            </div>
                          )}

                          {(line.itemType === 'TOOL' ||
                            line.itemType === 'OTHER') && (
                            <label className="lg:col-span-5">
                              <span className="mb-1 block text-sm font-medium text-primary">
                                Nombre / descripcion
                              </span>
                              <Input
                                value={line.itemName}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    itemName: event.target.value,
                                  })
                                }
                                disabled={submitting}
                                placeholder={
                                  line.itemType === 'TOOL'
                                    ? 'Ej. Tijeras industriales'
                                    : 'Ej. Servicio o elemento operativo'
                                }
                                className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                              />
                            </label>
                          )}

                          <label className="lg:col-span-1">
                            <span className="mb-1 block text-sm font-medium text-primary">
                              Cantidad
                            </span>
                            <Input
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  quantity: sanitizeQuantityInput(
                                    event.target.value,
                                  ),
                                })
                              }
                              disabled={submitting}
                              inputMode="decimal"
                              className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                            />
                          </label>

                          <label className="lg:col-span-1">
                            <span className="mb-1 block text-sm font-medium text-primary">
                              Unidad
                            </span>
                            <Input
                              value={line.unitOfMeasure}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  unitOfMeasure: event.target.value,
                                })
                              }
                              disabled={submitting}
                              list={`units-${line.id}`}
                              className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                            />
                            <datalist id={`units-${line.id}`}>
                              {UNIT_OPTIONS.map((unit) => (
                                <option key={unit} value={unit} />
                              ))}
                            </datalist>
                          </label>

                          <label className="lg:col-span-2">
                            <span className="mb-1 block text-sm font-medium text-primary">
                              Costo unitario
                            </span>
                            <Input
                              value={line.unitCostInput}
                              onChange={(event) =>
                                handleCurrencyInputChangeWithState(
                                  event,
                                  (state) =>
                                    updateLine(line.id, {
                                      unitCostInput: state.formattedValue,
                                      unitCost: state.numericValue,
                                    }),
                                )
                              }
                              disabled={submitting}
                              inputMode="decimal"
                              className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                            />
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_180px]">
                          <label>
                            <span className="mb-1 block text-sm font-medium text-primary">
                              Notas
                            </span>
                            <Input
                              value={line.notes}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  notes: event.target.value,
                                })
                              }
                              disabled={submitting}
                              placeholder="Referencia, observacion o uso esperado"
                              className="w-full rounded-xl border border-theme bg-surface px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                            />
                          </label>
                          <div className="rounded-2xl border border-theme bg-surface p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                              Subtotal visual
                            </p>
                            <p className="mt-1 font-black text-primary">
                              {formatCurrency(lineTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Flete / costo adicional
                  </span>
                  <Input
                    value={formData.freightCostInput}
                    onChange={(event) =>
                      handleCurrencyInputChangeWithState(event, (state) =>
                        setFormData((prev) => ({
                          ...prev,
                          freightCostInput: state.formattedValue,
                          freightCost: state.numericValue,
                        })),
                      )
                    }
                    disabled={submitting}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <div className="rounded-2xl border border-theme bg-base/40 p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted">Subtotal lineas</span>
                    <span className="font-black text-primary">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-bold text-muted">Flete</span>
                    <span className="font-black text-primary">
                      {formatCurrency(formData.freightCost)}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-theme pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-primary">
                        Total proyectado
                      </span>
                      <span className="text-lg font-black text-primary">
                        {formatCurrency(projectedTotal)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-muted">
                      El backend recalcula el total oficial y prorratea flete.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-theme pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={submitting}
                  className="rounded-xl border border-theme bg-base px-5 py-3 text-sm font-bold text-muted disabled:opacity-60"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-base-color disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmar recepcion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSupplyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-primary/20 p-4 backdrop-blur-sm">
          <div className="my-12 w-full max-w-xl rounded-3xl border border-theme bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-theme p-8">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  Crear insumo o empaque
                </h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  Quedara disponible para futuras recepciones.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (!creatingSupply) {
                    setIsSupplyModalOpen(false);
                    setCreatingSupplyForLine(null);
                  }
                }}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleCreateSupply} className="space-y-5 p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Nombre
                  </span>
                  <Input
                    value={supplyForm.name}
                    onChange={(event) =>
                      setSupplyForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    disabled={creatingSupply}
                    placeholder="Ej. Bolsa de envio"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    SKU
                  </span>
                  <Input
                    value={supplyForm.sku}
                    onChange={(event) =>
                      setSupplyForm((prev) => ({
                        ...prev,
                        sku: event.target.value,
                      }))
                    }
                    disabled={creatingSupply}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Categoria
                  </span>
                  <Input
                    value={supplyForm.category}
                    onChange={(event) =>
                      setSupplyForm((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                    disabled={creatingSupply}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Unidad
                  </span>
                  <Input
                    value={supplyForm.unitOfMeasure}
                    onChange={(event) =>
                      setSupplyForm((prev) => ({
                        ...prev,
                        unitOfMeasure: event.target.value,
                      }))
                    }
                    disabled={creatingSupply}
                    list="new-supply-units"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                  <datalist id="new-supply-units">
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Costo base
                  </span>
                  <Input
                    value={supplyForm.costInput}
                    onChange={(event) =>
                      handleCurrencyInputChangeWithState(event, (state) =>
                        setSupplyForm((prev) => ({
                          ...prev,
                          costInput: state.formattedValue,
                          cost: state.numericValue,
                        })),
                      )
                    }
                    disabled={creatingSupply}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium text-primary">
                    Stock minimo
                  </span>
                  <Input
                    value={supplyForm.minStock}
                    onChange={(event) =>
                      setSupplyForm((prev) => ({
                        ...prev,
                        minStock: sanitizeQuantityInput(event.target.value),
                      }))
                    }
                    disabled={creatingSupply}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-theme pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    if (!creatingSupply) {
                      setIsSupplyModalOpen(false);
                      setCreatingSupplyForLine(null);
                    }
                  }}
                  disabled={creatingSupply}
                  className="rounded-xl border border-theme bg-base px-5 py-3 text-sm font-bold text-muted disabled:opacity-60"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creatingSupply}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-base-color disabled:opacity-60"
                >
                  {creatingSupply ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Crear insumo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceptionMetricCard({
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
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <h3 className="mt-1 text-2xl font-black text-primary">{value}</h3>
      <p className="mt-2 text-[11px] font-medium text-muted">{detail}</p>
    </div>
  );
}
