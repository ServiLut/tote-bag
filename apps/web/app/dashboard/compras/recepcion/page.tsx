'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Package,
  Truck,
  Calendar,
  Loader2,
  Database,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Product } from '@/types/product';
import { Button, Input, Select } from '@tote-bag/ui';
import { useRouter } from 'next/navigation';

interface Supplier {
  id: string;
  name: string;
  nit: string;
}

interface PurchaseBatch {
  id: string;
  productId: string;
  supplierId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  status: string;
  createdAt: string;
  product: { name: string };
  supplier: { name: string };
}

interface BatchItem {
  productId: string;
  variantId: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
}

export default function BatchReceptionPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    totalCost: 0,
    status: 'RECIBIDO',
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [{ productId: '', variantId: '', nombre: '', cantidad: 1, costoUnitario: 0 }] as BatchItem[]
  });

  // El puerto por defecto en el backend es 4000 segÃƒÆ’Ã‚Âºn apps/api/src/main.ts
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api/v1';

  const fetchData = useCallback(async () => {
    try {
      const [batchesRes, productsRes, suppliersRes] = await Promise.all([
        fetch(`${API_URL}/inventory/batches`),
        fetch(`${API_URL}/catalog/products`),
        fetch(`${API_URL}/inventory/suppliers`),
      ]);

      if (batchesRes.ok) {
        const result = await batchesRes.json();
        setBatches(result.data || result || []);
      }
      if (productsRes.ok) {
        const result = await productsRes.json();
        setProducts(result.data || result || []);
      }
      if (suppliersRes.ok) {
        const result = await suppliersRes.json();
        setSuppliers(result.data || result || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', variantId: '', nombre: '', cantidad: 1, costoUnitario: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);

    // Recalcular total
    const newTotal = newItems.reduce((sum, item) => sum + (item.cantidad * item.costoUnitario), 0);

    setFormData({
      ...formData,
      items: newItems,
      totalCost: newTotal
    });
  };

  const updateItem = (index: number, field: keyof BatchItem, value: string | number) => {
    const newItems = [...formData.items];

    if (field === 'productId') {
      const product = products?.find(p => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        variantId: '',
        nombre: product?.name || '',
        costoUnitario: product?.costPrice || newItems[index].costoUnitario || 0
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value } as BatchItem;
    }

    // Recalcular total de este lote
    const newTotal = newItems.reduce((sum, item) => sum + (item.cantidad * item.costoUnitario), 0);

    setFormData({
      ...formData,
      items: newItems,
      totalCost: newTotal
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      alert('Por favor selecciona un proveedor.');
      return;
    }

    if (formData.items.some(i => !i.productId || !i.variantId || i.cantidad <= 0)) {
      alert('Por favor completa todos los items con producto, variante y cantidades vÃƒÆ’Ã‚Â¡lidas.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/inventory/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          supplierId: '',
          totalCost: 0,
          status: 'RECIBIDO',
          purchaseDate: new Date().toISOString().split('T')[0],
          items: [{ productId: '', variantId: '', nombre: '', cantidad: 1, costoUnitario: 0 }]
        });
        await fetchData();
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Error: ${error.message || 'Error desconocido al registrar el lote'}`);
      }
    } catch (err) {
      console.error('Error receiving batch:', err);
      alert('Error de conexiÃƒÆ’Ã‚Â³n con el servidor. Verifica que el backend estÃƒÆ’Ã‚Â© corriendo en ' + API_URL);
    } finally {
      setSubmitting(false);
    }
  };

  const getVariantsForProduct = (productId: string) => {
    return products.find((p) => p.id === productId)?.variants || [];
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBatches = batches.filter((batch) => {
    if (!normalizedSearch) return true;

    const productName = batch.product?.name?.toLowerCase() || '';
    const supplierName = batch.supplier?.name?.toLowerCase() || '';
    const status = batch.status?.toLowerCase() || '';
    const batchId = batch.id?.toLowerCase() || '';

    return (
      productName.includes(normalizedSearch) ||
      supplierName.includes(normalizedSearch) ||
      status.includes(normalizedSearch) ||
      batchId.includes(normalizedSearch)
    );
  });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Recepción de Mercancía</h1>
          </div>
          <p className="text-muted font-medium">Alimenta el inventario FIFO y registra las facturas de compra automáticamente.</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-base-color font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nuevo Lote
        </Button>
      </div>

      {/* Batches Table */}
      <div className="bg-surface border border-theme rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-theme bg-base/50 flex items-center justify-between">
          <h2 className="font-bold text-primary flex items-center gap-2">
            <Package className="w-5 h-5 text-primary/60" />
            Lotes Activos e Historial
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              type="text"
              placeholder="Buscar lote o producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-base border border-theme rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all w-64"
            />
          </div>
        </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted font-medium">                    {batches.length === 0
                      ? 'No hay lotes registrados todavÃ­a.'
                      : 'No se encontraron lotes con ese filtro.'}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4 font-bold text-primary text-sm">{batch.product?.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted font-bold text-xs uppercase">
                        <Truck className="w-3.5 h-3.5" />
                        {batch.supplier?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-black text-primary">{batch.quantityRemaining} <span className="text-[10px] text-muted font-bold">/ {batch.quantityReceived}</span></span>
                        <div className="w-24 h-1.5 bg-theme rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              batch.quantityRemaining === 0 ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${(batch.quantityRemaining / batch.quantityReceived) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary/70 text-sm">
                      ${batch.totalCost.toLocaleString('es-CO')}
                      <div className="text-[10px] text-muted">unit: ${batch.unitCost.toLocaleString('es-CO')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted font-medium text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        batch.status === 'IN_STOCK'
                          ? 'bg-emerald-100 text-emerald-700'
                          : batch.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : batch.status === 'DEPLETED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {batch.status === 'IN_STOCK' ? <CheckCircle2 className="w-3 h-3" /> : batch.status === 'PENDING' ? <AlertCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {batch.status === 'IN_STOCK' ? 'En Stock' : batch.status === 'PENDING' ? 'Pendiente' : 'Agotado'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

          <div className="relative bg-surface w-full max-w-4xl rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-6 border-b border-theme bg-primary text-base-color">
              <h2 className="text-2xl font-black">Nuevo Lote de Compra</h2>
              <p className="text-primary-foreground/70 font-medium text-sm mt-1">Registra la compra de mÃƒÆ’Ã‚Âºltiples insumos o materias primas.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Proveedor</label>
                  <Select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Estado</label>
                  <Select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="RECIBIDO">RECIBIDO (Suma al stock)</option>
                    <option value="PENDIENTE">PENDIENTE (Sin stock)</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Fecha</label>
                  <Input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    ÃƒÆ’Ã‚Âtems del Lote
                  </h3>
                  <Button
                    type="button"
                    onClick={addItem}
                    className="text-[10px] font-black uppercase bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar ÃƒÆ’Ã‚Âtem
                  </Button>
                </div>

                <div className="border border-theme rounded-2xl overflow-hidden bg-base/30">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-base/50 text-[10px] uppercase font-black text-muted/60 border-b border-theme">
                      <tr>
                        <th className="px-4 py-3">Insumo / Producto</th>
                        <th className="px-4 py-3">Variante</th>
                        <th className="px-4 py-3 w-32">Cantidad</th>
                        <th className="px-4 py-3 w-40">Costo Unit.</th>
                        <th className="px-4 py-3 w-40">Subtotal</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <Select
                              required
                              value={item.productId}
                              onChange={(e) => updateItem(index, 'productId', e.target.value)}
                              className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none"
                            >
                              <option value="">Seleccionar producto...</option>
                              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              required
                              value={item.variantId}
                              onChange={(e) => updateItem(index, 'variantId', e.target.value)}
                              disabled={!item.productId}
                              className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none disabled:opacity-50"
                            >
                              <option value="">Seleccionar variante...</option>
                              {getVariantsForProduct(item.productId).map((variant) => (
                                <option key={variant.id || variant.sku} value={variant.id || ''}>
                                  {variant.color} - {variant.sku}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => updateItem(index, 'cantidad', parseInt(e.target.value) || 0)}
                              className="w-full bg-transparent border-none text-sm font-bold text-center focus:ring-0 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-muted text-xs">$</span>
                              <Input
                                type="number"
                                min="0"
                                value={item.costoUnitario}
                                onChange={(e) => updateItem(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-primary/70">
                            ${(item.cantidad * item.costoUnitario).toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-right">
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

              {/* Summary and Footer */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-theme">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Total InversiÃƒÆ’Ã‚Â³n</span>
                    <span className="text-2xl font-black text-primary">${formData.totalCost.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="h-10 w-[1px] bg-theme hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Items Totales</span>
                    <span className="text-lg font-bold text-primary">{formData.items.reduce((sum, i) => sum + (i.cantidad || 0), 0)} und.</span>
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
                    disabled={submitting || formData.items.some(i => !i.productId || !i.variantId)}
                    className="px-8 py-3 bg-primary text-base-color font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirmar Compra
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


