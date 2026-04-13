'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Database,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Input,
  InputGroup,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from '@tote-bag/ui';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
  sanitizeIntegerInput,
} from '@/lib/numeric-input';
import { Product } from '@/types/product';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';
import { notifyFinanceDataChanged } from '@/lib/finance-events';

interface Supplier {
  id: string;
  name: string;
  nit: string;
}

interface PurchaseBatch {
  id: string;
  productId: string;
  variantId: string | null;
  supplierId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  status: string;
  paymentReceiptUrl?: string | null;
  createdAt: string;
  product: { name: string };
  variant?: { id?: string; sku?: string; color?: string } | null;
  supplier: { name: string };
}

interface BatchItem {
  productId: string;
  variantId: string;
  nombre: string;
  size: string;
  material: string;
  cantidad: number;
  costoUnitarioInput: string;
  costoUnitario: number;
}

interface EditBatchFormData {
  supplierId: string;
  productId: string;
  variantId: string;
  quantityReceived: number;
  unitCostInput: string;
  unitCost: number;
  status: 'RECIBIDO' | 'PENDIENTE';
  purchaseDate: string;
}

export default function BatchReceptionPage() {
  const createEmptyItem = (): BatchItem => ({
    productId: '',
    variantId: '',
    nombre: '',
    size: '',
    material: '',
    cantidad: 1,
    costoUnitarioInput: '',
    costoUnitario: 0,
  });

  const getBatchInputStatus = (
    batch: PurchaseBatch,
  ): EditBatchFormData['status'] =>
    batch.status === 'PENDING' ? 'PENDIENTE' : 'RECIBIDO';

  const createEditFormFromBatch = (batch: PurchaseBatch): EditBatchFormData => {
    const costState = createCurrencyInputState(batch.unitCost);

    return {
      supplierId: batch.supplierId,
      productId: batch.productId,
      variantId: batch.variantId || '',
      quantityReceived: batch.quantityReceived,
      unitCostInput: costState.formattedValue,
      unitCost: costState.numericValue,
      status: getBatchInputStatus(batch),
      purchaseDate: new Date(batch.createdAt).toISOString().split('T')[0],
    };
  };

  const canModifyBatch = (batch: PurchaseBatch) =>
    batch.status === 'PENDING' ||
    batch.quantityRemaining === batch.quantityReceived;

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'IN_STOCK' | 'PENDING' | 'DEPLETED'
  >('all');
  const [stockFilter, setStockFilter] = useState<
    'all' | 'available' | 'partial' | 'empty'
  >('all');
  const [entryDateFilter, setEntryDateFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    supplierId: '',
    totalCost: 0,
    freightCostInput: '',
    freightCost: 0,
    status: 'RECIBIDO',
    documentType: 'INVOICE',
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [createEmptyItem()] as BatchItem[],
  });
  const [editFormData, setEditFormData] = useState<EditBatchFormData>({
    supplierId: '',
    productId: '',
    variantId: '',
    quantityReceived: 1,
    unitCostInput: '',
    unitCost: 0,
    status: 'RECIBIDO',
    purchaseDate: new Date().toISOString().split('T')[0],
  });

  const getAuthHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    // We call getUser() to ensure the session is refreshed if needed
    await supabase.auth.getUser();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(
        'Tu sesion expiro o no esta disponible. Inicia sesion nuevamente.',
      );
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }, [supabase.auth]);

  const fetchData = useCallback(async () => {
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const [batchesRes, productsRes, suppliersRes] = await Promise.all([
        apiFetch('/inventory/batches', { headers: authHeaders }),
        apiFetch('/catalog/admin/products', { headers: authHeaders }),
        apiFetch('/inventory/suppliers', { headers: authHeaders }),
      ]);

      if (batchesRes.status === 401 || suppliersRes.status === 401) {
        throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
      }

      if (batchesRes.status === 403 || suppliersRes.status === 403) {
        throw new Error(
          'No tienes permisos para gestionar recepcion de lotes.',
        );
      }

      if (batchesRes.ok) {
        const result = await batchesRes.json();
        setBatches(result.data || result || []);
      } else {
        setBatches([]);
      }

      if (productsRes.ok) {
        const result = await productsRes.json();
        setProducts(result.data || result || []);
      } else {
        setProducts([]);
      }

      if (suppliersRes.ok) {
        const result = await suppliersRes.json();
        setSuppliers(result.data || result || []);
      } else {
        setSuppliers([]);
      }

      if (!batchesRes.ok || !productsRes.ok || !suppliersRes.ok) {
        setError(
          'La vista cargo parcialmente. Algunos datos no estuvieron disponibles.',
        );
      }
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setBatches([]);
      setSuppliers([]);

      const errorMessage =
        fetchError instanceof Error
          ? fetchError.message
          : 'Error cargando la recepcion de lotes.';

      setError(errorMessage);

      if (
        errorMessage.includes('sesion expiro') ||
        errorMessage.includes('no esta disponible')
      ) {
        router.push(
          `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const incomingSearch = searchParams.get('search')?.trim() || '';
    if (incomingSearch) {
      setSearch(incomingSearch);
    }
  }, [searchParams]);

  const resolveApiErrorMessage = async (
    response: Response,
    fallback: string,
  ) => {
    const errorBody = await response.json().catch(() => null);
    return errorBody?.message || fallback;
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingBatchId(null);
  };

  const openEditModal = (batch: PurchaseBatch) => {
    setError(null);
    setEditingBatchId(batch.id);
    setEditFormData(createEditFormFromBatch(batch));
    setIsEditModalOpen(true);
  };

  const addItem = () => {
    setFormData((current) => ({
      ...current,
      items: [...current.items, createEmptyItem()],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;

    const newItems = [...formData.items];
    newItems.splice(index, 1);

    const newTotal = newItems.reduce(
      (sum, item) => sum + item.cantidad * item.costoUnitario,
      0,
    );

    setFormData({
      ...formData,
      items: newItems,
      totalCost: newTotal,
    });
  };

  const updateItem = (
    index: number,
    field: keyof BatchItem,
    value: string | number,
  ) => {
    const newItems = [...formData.items];

    if (field === 'productId') {
      const product = products.find((item) => item.id === value);
      const fallbackVariant =
        product?.variants.find((variant) => variant.isActive !== false) ||
        product?.variants[0];
      const costState = createCurrencyInputState(
        fallbackVariant?.costPrice || newItems[index].costoUnitario || 0,
      );

      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        variantId: '',
        nombre: product?.name || '',
        size: '',
        material: '',
        costoUnitarioInput: costState.formattedValue,
        costoUnitario: costState.numericValue,
      };
    } else if (field === 'variantId') {
      const product = products.find(
        (item) => item.id === newItems[index].productId,
      );
      const variant = product?.variants.find((item) => item.id === value);
      const costState = createCurrencyInputState(
        variant?.costPrice || newItems[index].costoUnitario || 0,
      );

      newItems[index] = {
        ...newItems[index],
        variantId: value as string,
        size: variant?.size || newItems[index].size,
        costoUnitarioInput: costState.formattedValue,
        costoUnitario: costState.numericValue,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value } as BatchItem;
    }

    const newTotal = newItems.reduce(
      (sum, item) => sum + item.cantidad * item.costoUnitario,
      0,
    );

    setFormData({
      ...formData,
      items: newItems,
      totalCost: newTotal,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      alert('Por favor selecciona un proveedor.');
      return;
    }

    if (
      formData.items.some(
        (item) => !item.productId || !item.variantId || item.cantidad <= 0,
      )
    ) {
      alert(
        'Por favor completa todos los items con producto, variante y cantidades validas.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch('/inventory/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          ...formData,
          totalCost: formData.totalCost,
          freightCost: formData.freightCost,
          documentType: formData.documentType,
          items: formData.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            nombre: [item.nombre, item.size, item.material]
              .filter((value) => value && value.trim().length > 0)
              .join(' · '),
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
          })),
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
        }

        if (res.status === 403) {
          throw new Error('No tienes permisos para registrar lotes.');
        }

        const errorBody = await res.json().catch(() => null);
        throw new Error(
          errorBody?.message || 'Error desconocido al registrar el lote',
        );
      }

      setIsModalOpen(false);
      setFormData({
        supplierId: '',
        totalCost: 0,
        freightCostInput: '',
        freightCost: 0,
        status: 'RECIBIDO',
        documentType: 'INVOICE',
        purchaseDate: new Date().toISOString().split('T')[0],
        items: [createEmptyItem()],
      });
      await fetchData();
      notifyFinanceDataChanged();
    } catch (submitError) {
      console.error('Error receiving batch:', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Error de conexion con el servidor. No fue posible registrar el lote.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getVariantsForProduct = (productId: string) => {
    return products.find((product) => product.id === productId)?.variants || [];
  };

  const getAttributeOptionsForProduct = (
    productId: string,
    type: 'MATERIAL',
  ) => {
    const product = products.find((item) => item.id === productId);
    return (product?.attributes || []).filter(
      (attribute) => attribute.type === type && attribute.isActive,
    );
  };

  const handleEditFieldChange = (
    field: keyof EditBatchFormData,
    value: string | number,
  ) => {
    setEditFormData((current) => {
      if (field === 'productId') {
        const product = products.find((item) => item.id === value);
        const fallbackVariant =
          product?.variants.find((variant) => variant.isActive !== false) ||
          product?.variants[0];
        const costState = createCurrencyInputState(
          fallbackVariant?.costPrice || current.unitCost || 0,
        );

        return {
          ...current,
          productId: value as string,
          variantId: '',
          unitCostInput: costState.formattedValue,
          unitCost: costState.numericValue,
        };
      }

      if (field === 'variantId') {
        const product = products.find((item) => item.id === current.productId);
        const variant = product?.variants.find((item) => item.id === value);
        const costState = createCurrencyInputState(
          variant?.costPrice || current.unitCost || 0,
        );

        return {
          ...current,
          variantId: value as string,
          unitCostInput: costState.formattedValue,
          unitCost: costState.numericValue,
        };
      }

      return {
        ...current,
        [field]: value,
      } as EditBatchFormData;
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingBatchId) {
      return;
    }

    if (
      !editFormData.supplierId ||
      !editFormData.productId ||
      !editFormData.variantId ||
      editFormData.quantityReceived <= 0
    ) {
      setError(
        'Completa proveedor, producto, variante y cantidad valida para editar el lote.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await apiFetch(`/inventory/batches/${editingBatchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          supplierId: editFormData.supplierId,
          productId: editFormData.productId,
          variantId: editFormData.variantId,
          quantityReceived: editFormData.quantityReceived,
          unitCost: editFormData.unitCost,
          status: editFormData.status,
          purchaseDate: editFormData.purchaseDate,
        }),
      });

      if (!response.ok) {
        setError(
          await resolveApiErrorMessage(
            response,
            'No fue posible actualizar el lote.',
          ),
        );
        return;
      }

      closeEditModal();
      await fetchData();
      notifyFinanceDataChanged();
    } catch (submitError) {
      console.error('Error updating batch:', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible actualizar el lote.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batch: PurchaseBatch) => {
    if (deletingBatchId) {
      return;
    }

    const confirmed = window.confirm(
      `Deseas borrar el lote de ${batch.product?.name || 'este producto'}? Esta accion revertira su impacto en inventario y compras.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingBatchId(batch.id);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await apiFetch(`/inventory/batches/${batch.id}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        setError(
          await resolveApiErrorMessage(
            response,
            'No fue posible borrar el lote.',
          ),
        );
        return;
      }

      if (editingBatchId === batch.id) {
        closeEditModal();
      }

      await fetchData();
      notifyFinanceDataChanged();
    } catch (deleteError) {
      console.error('Error deleting batch:', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible borrar el lote.',
      );
    } finally {
      setDeletingBatchId(null);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBatches = batches.filter((batch) => {
    const batchDate = new Date(batch.createdAt).toISOString().split('T')[0];
    const stockState =
      batch.quantityRemaining === 0
        ? 'empty'
        : batch.quantityRemaining === batch.quantityReceived
          ? 'available'
          : 'partial';

    if (entryDateFilter && batchDate !== entryDateFilter) return false;
    if (statusFilter !== 'all' && batch.status !== statusFilter) return false;
    if (stockFilter !== 'all' && stockState !== stockFilter) return false;

    const productName = batch.product?.name?.toLowerCase() || '';
    const variantSku = batch.variant?.sku?.toLowerCase() || '';
    const variantColor = batch.variant?.color?.toLowerCase() || '';
    const supplierName = batch.supplier?.name?.toLowerCase() || '';
    const status = batch.status?.toLowerCase() || '';
    const batchId = batch.id?.toLowerCase() || '';

    return (
      !normalizedSearch ||
      productName.includes(normalizedSearch) ||
      variantSku.includes(normalizedSearch) ||
      variantColor.includes(normalizedSearch) ||
      supplierName.includes(normalizedSearch) ||
      status.includes(normalizedSearch) ||
      batchId.includes(normalizedSearch)
    );
  });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Recepcion de Mercancia
            </h1>
          </div>
          <p className="text-muted font-medium">
            Alimenta el inventario FIFO y registra las facturas de compra
            automaticamente.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-base-color font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nuevo Lote
        </Button>
      </div>

      <div className="bg-surface border border-theme rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-theme bg-base/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-primary flex items-center gap-2">
              <Package className="w-5 h-5 text-primary/60" />
              Lotes Activos e Historial
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                type="text"
                placeholder="Buscar lote, producto o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-base border border-theme rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all w-full"
              />
            </div>
            <Input
              type="date"
              value={entryDateFilter}
              onChange={(e) => setEntryDateFilter(e.target.value)}
              className="bg-base border border-theme rounded-lg text-xs font-medium"
            />
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="bg-base border border-theme rounded-lg text-xs font-bold"
            >
              <option value="all">Todos los estados</option>
              <option value="IN_STOCK">En stock</option>
              <option value="PENDING">Pendiente</option>
              <option value="DEPLETED">Agotado</option>
            </Select>
            <Select
              value={stockFilter}
              onChange={(e) =>
                setStockFilter(e.target.value as typeof stockFilter)
              }
              className="bg-base border border-theme rounded-lg text-xs font-bold"
            >
              <option value="all">Todo el stock</option>
              <option value="available">Stock completo</option>
              <option value="partial">Stock parcial</option>
              <option value="empty">Sin stock</option>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/30 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Proveedor</th>
                <th className="px-6 py-4">Stock Restante</th>
                <th className="px-6 py-4">Costo Total</th>
                <th className="px-6 py-4">Fecha Ingreso</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-muted font-medium"
                  >
                    {batches.length === 0
                      ? 'No hay lotes registrados todavia.'
                      : 'No se encontraron lotes con ese filtro.'}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="hover:bg-primary/5 transition-colors group"
                  >
                    <td className="px-6 py-4 font-bold text-primary text-sm">
                      <div className="flex flex-col">
                        <span>{batch.product?.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                          {batch.variant?.sku || batch.variant?.color
                            ? `${batch.variant?.color || 'Variante'}${batch.variant?.sku ? ` - ${batch.variant.sku}` : ''}`
                            : 'Sin variante visible'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted font-bold text-xs uppercase">
                        <Truck className="w-3.5 h-3.5" />
                        {batch.supplier?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-black text-primary">
                          {batch.quantityRemaining}{' '}
                          <span className="text-[10px] text-muted font-bold">
                            / {batch.quantityReceived}
                          </span>
                        </span>
                        <div className="w-24 h-1.5 bg-theme rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              batch.quantityRemaining === 0
                                ? 'bg-red-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${(batch.quantityRemaining / batch.quantityReceived) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary/70 text-sm">
                      ${batch.totalCost.toLocaleString('es-CO')}
                      <div className="text-[10px] text-muted">
                        unit: ${batch.unitCost.toLocaleString('es-CO')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted font-medium text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          batch.status === 'IN_STOCK'
                            ? 'bg-emerald-100 text-emerald-700'
                            : batch.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-700'
                              : batch.status === 'DEPLETED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {batch.status === 'IN_STOCK' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : batch.status === 'PENDING' ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {batch.status === 'IN_STOCK'
                          ? 'En Stock'
                          : batch.status === 'PENDING'
                            ? 'Pendiente'
                            : 'Agotado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <Popover
                          open={activeActionMenu === batch.id}
                          onOpenChange={(open) =>
                            setActiveActionMenu(open ? batch.id : null)
                          }
                        >
                          <PopoverTrigger>
                            <button
                              type="button"
                              className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary transition-colors hover:bg-primary/5"
                              aria-label={`Acciones para lote ${batch.id.slice(0, 8)}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="end"
                            className="w-60 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenu(null);
                                openEditModal(batch);
                              }}
                              disabled={
                                !canModifyBatch(batch) ||
                                deletingBatchId === batch.id
                              }
                              title={
                                canModifyBatch(batch)
                                  ? 'Editar lote'
                                  : 'Solo puedes editar lotes sin movimiento de stock'
                              }
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil className="h-4 w-4" />
                              {canModifyBatch(batch)
                                ? 'Editar'
                                : 'Sin movimiento de stock para editar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenu(null);
                                void handleDeleteBatch(batch);
                              }}
                              disabled={
                                !canModifyBatch(batch) ||
                                deletingBatchId === batch.id
                              }
                              title={
                                canModifyBatch(batch)
                                  ? 'Borrar lote'
                                  : 'Solo puedes borrar lotes sin movimiento de stock'
                              }
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingBatchId === batch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {canModifyBatch(batch)
                                ? 'Borrar'
                                : 'Sin movimiento de stock para borrar'}
                            </button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={closeEditModal}
          />

          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="border-b border-theme bg-primary p-6 text-base-color">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Editar Lote</h2>
                  <p className="mt-1 text-sm font-medium text-primary-foreground/70">
                    Corrige un lote registrado con errores antes de que tenga
                    movimientos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl p-2 transition-colors hover:bg-white/10"
                  aria-label="Cerrar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Proveedor
                  </label>
                  <Select
                    required
                    value={editFormData.supplierId}
                    onChange={(e) =>
                      handleEditFieldChange('supplierId', e.target.value)
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Seleccionar...</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Estado
                  </label>
                  <Select
                    required
                    value={editFormData.status}
                    onChange={(e) =>
                      handleEditFieldChange('status', e.target.value)
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="RECIBIDO">RECIBIDO (Suma al stock)</option>
                    <option value="PENDIENTE">PENDIENTE (Sin stock)</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Producto
                  </label>
                  <Select
                    required
                    value={editFormData.productId}
                    onChange={(e) =>
                      handleEditFieldChange('productId', e.target.value)
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Seleccionar producto...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Variante
                  </label>
                  <Select
                    required
                    value={editFormData.variantId}
                    onChange={(e) =>
                      handleEditFieldChange('variantId', e.target.value)
                    }
                    disabled={!editFormData.productId}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  >
                    <option value="">Seleccionar variante...</option>
                    {getVariantsForProduct(editFormData.productId).map(
                      (variant) => (
                        <option
                          key={variant.id || variant.sku}
                          value={variant.id || ''}
                        >
                          {[variant.size, variant.color, variant.sku]
                            .filter(Boolean)
                            .join(' - ')}
                        </option>
                      ),
                    )}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Cantidad
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={
                      editFormData.quantityReceived === 0
                        ? ''
                        : String(editFormData.quantityReceived)
                    }
                    onChange={(e) => {
                      const nextValue = sanitizeIntegerInput(e.target.value);
                      if (nextValue !== null) {
                        handleEditFieldChange(
                          'quantityReceived',
                          parseInt(nextValue, 10) || 0,
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Costo Unitario
                  </label>
                  <InputGroup
                    prefix={<span className="text-xs text-muted">$</span>}
                    className="flex items-center gap-1"
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={editFormData.unitCostInput}
                      onChange={(e) =>
                        handleCurrencyInputChangeWithState(e, (nextValue) =>
                          setEditFormData((current) => ({
                            ...current,
                            unitCostInput: nextValue.formattedValue,
                            unitCost: nextValue.numericValue,
                          })),
                        )
                      }
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                    />
                  </InputGroup>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Fecha
                  </label>
                  <Input
                    type="date"
                    required
                    value={editFormData.purchaseDate}
                    onChange={(e) =>
                      handleEditFieldChange('purchaseDate', e.target.value)
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-theme bg-base/40 px-4 py-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Total corregido
                  </div>
                  <div className="text-xl font-black text-primary">
                    $
                    {(
                      editFormData.quantityReceived * editFormData.unitCost
                    ).toLocaleString('es-CO')}
                  </div>
                </div>
                <div className="text-right text-xs font-medium text-muted">
                  Solo se permiten lotes sin movimientos de stock ni facturas
                  asociadas.
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  onClick={closeEditModal}
                  className="cursor-pointer rounded-2xl border border-theme bg-base px-6 py-3 font-bold text-muted transition-all hover:bg-theme/5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3 font-black text-base-color shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative bg-surface w-full max-w-4xl rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-6 border-b border-theme bg-primary text-base-color">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Nuevo Lote de Compra</h2>
                  <p className="text-primary-foreground/70 font-medium text-sm mt-1">
                    Registra la compra de multiples insumos o materias primas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 transition-colors hover:bg-white/10"
                  aria-label="Cerrar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Proveedor
                  </label>
                  <Select
                    required
                    value={formData.supplierId}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierId: e.target.value })
                    }
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Documento
                  </label>
                  <Select
                    required
                    value={formData.documentType}
                    onChange={(e) =>
                      setFormData({ ...formData, documentType: e.target.value })
                    }
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="INVOICE">Factura</option>
                    <option value="DELIVERY_NOTE">Remision</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Estado
                  </label>
                  <Select
                    required
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="RECIBIDO">RECIBIDO (Suma al stock)</option>
                    <option value="PENDIENTE">PENDIENTE (Sin stock)</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Fecha
                  </label>
                  <Input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseDate: e.target.value })
                    }
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Fletes
                  </label>
                  <InputGroup
                    prefix={<span className="text-xs text-muted">$</span>}
                    className="flex items-center gap-1"
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.freightCostInput}
                      onChange={(e) =>
                        handleCurrencyInputChangeWithState(e, (nextValue) =>
                          setFormData((current) => ({
                            ...current,
                            freightCostInput: nextValue.formattedValue,
                            freightCost: nextValue.numericValue,
                          })),
                        )
                      }
                      className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </InputGroup>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Items del Lote
                  </h3>
                  <Button
                    type="button"
                    onClick={addItem}
                    className="text-[10px] font-black uppercase bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Item
                  </Button>
                </div>

                <div className="border border-theme rounded-2xl overflow-hidden bg-base/30">
                  <table className="w-full table-fixed text-left border-collapse">
                    <thead className="bg-base/50 text-[10px] uppercase font-black text-muted/60 border-b border-theme">
                      <tr>
                        <th className="w-[22%] px-5 py-3.5">
                          Insumo / Producto
                        </th>
                        <th className="w-[16%] px-4 py-3.5 text-center">
                          Variante
                        </th>
                        <th className="px-4 py-3">Tamaño</th>
                        <th className="w-[14%] px-4 py-3.5 text-center">
                          Tela
                        </th>
                        <th className="w-[10%] px-4 py-3.5 text-center">
                          Cantidad
                        </th>
                        <th className="w-[12%] px-4 py-3.5 text-center">
                          Costo Unit.
                        </th>
                        <th className="w-[10%] px-4 py-3.5 text-center">
                          Subtotal
                        </th>
                        <th className="w-[2%] px-4 py-3.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {formData.items.map((item, index) => (
                        <tr key={`${item.productId}-${index}`}>
                          <td className="px-5 py-3.5">
                            <Select
                              required
                              value={item.productId}
                              onChange={(e) =>
                                updateItem(index, 'productId', e.target.value)
                              }
                              className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none"
                            >
                              <option value="">Seleccionar producto...</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-4 py-3.5">
                            <Select
                              required
                              value={item.variantId}
                              onChange={(e) =>
                                updateItem(index, 'variantId', e.target.value)
                              }
                              disabled={!item.productId}
                              className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none disabled:opacity-50"
                            >
                              <option value="">Seleccionar variante...</option>
                              {getVariantsForProduct(item.productId).map(
                                (variant) => (
                                  <option
                                    key={variant.id || variant.sku}
                                    value={variant.id || ''}
                                  >
                                    {[variant.size, variant.color, variant.sku]
                                      .filter(Boolean)
                                      .join(' - ')}
                                  </option>
                                ),
                              )}
                            </Select>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="px-2 text-sm font-bold text-primary">
                              {item.size || 'Se define al elegir variante'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <Select
                              value={item.material}
                              onChange={(e) =>
                                updateItem(index, 'material', e.target.value)
                              }
                              disabled={!item.productId}
                              className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none disabled:opacity-50"
                            >
                              <option value="">Seleccionar tela...</option>
                              {getAttributeOptionsForProduct(
                                item.productId,
                                'MATERIAL',
                              ).map((attribute) => (
                                <option
                                  key={attribute.id}
                                  value={attribute.value}
                                >
                                  {attribute.value}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-4 py-3.5">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={
                                item.cantidad === 0 ? '' : String(item.cantidad)
                              }
                              onChange={(e) => {
                                const nextValue = sanitizeIntegerInput(
                                  e.target.value,
                                );
                                if (nextValue !== null) {
                                  updateItem(
                                    index,
                                    'cantidad',
                                    parseInt(nextValue, 10) || 0,
                                  );
                                }
                              }}
                              className="w-full bg-transparent border-none text-sm font-bold text-center focus:ring-0 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <InputGroup
                              prefix={
                                <span className="text-xs text-muted">$</span>
                              }
                              className="flex items-center gap-1"
                            >
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.costoUnitarioInput}
                                onChange={(e) =>
                                  handleCurrencyInputChangeWithState(
                                    e,
                                    (nextValue) =>
                                      setFormData((current) => {
                                        const nextItems = [...current.items];
                                        nextItems[index] = {
                                          ...nextItems[index],
                                          costoUnitarioInput:
                                            nextValue.formattedValue,
                                          costoUnitario: nextValue.numericValue,
                                        };

                                        return {
                                          ...current,
                                          items: nextItems,
                                          totalCost: nextItems.reduce(
                                            (sum, currentItem) =>
                                              sum +
                                              currentItem.cantidad *
                                                currentItem.costoUnitario,
                                            0,
                                          ),
                                        };
                                      }),
                                  )
                                }
                                className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none"
                              />
                            </InputGroup>
                          </td>
                          <td className="px-4 py-3.5 text-center text-sm font-black text-primary/70">
                            $
                            {(
                              item.cantidad * item.costoUnitario
                            ).toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-theme">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Total Inversion
                    </span>
                    <span className="text-2xl font-black text-primary">
                      ${formData.totalCost.toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="h-10 w-[1px] bg-theme hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Fletes
                    </span>
                    <span className="text-lg font-bold text-primary">
                      ${formData.freightCost.toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="h-10 w-[1px] bg-theme hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Items Totales
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formData.items.reduce(
                        (sum, item) => sum + (item.cantidad || 0),
                        0,
                      )}{' '}
                      und.
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                  <Button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 bg-base border border-theme rounded-2xl font-bold text-muted hover:bg-theme/5 transition-all cursor-pointer"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      formData.items.some(
                        (item) => !item.productId || !item.variantId,
                      )
                    }
                    className="px-8 py-3 bg-primary text-base-color font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Confirmar Compra
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
