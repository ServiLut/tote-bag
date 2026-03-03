'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Package, 
  Truck, 
  Calendar, 
  DollarSign, 
  Loader2, 
  Database,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Product } from '@/types/product';

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

export default function BatchReceptionPage() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    productId: '',
    supplierId: '',
    quantityReceived: 0,
    unitCost: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

  const fetchData = async () => {
    try {
      const [batchesRes, productsRes, suppliersRes] = await Promise.all([
        fetch(`${API_URL}/inventory/batches`),
        fetch(`${API_URL}/catalog/products`),
        fetch(`${API_URL}/inventory/suppliers`),
      ]);

      if (batchesRes.ok) {
        const data = await batchesRes.json();
        setBatches(data);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || []);
      }
      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [API_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/inventory/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          productId: '',
          supplierId: '',
          quantityReceived: 0,
          unitCost: 0,
          purchaseDate: new Date().toISOString().split('T')[0],
        });
        fetchData();
      }
    } catch (err) {
      console.error('Error creating batch:', err);
    } finally {
      setSubmitting(false);
    }
  };

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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-base-color font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nuevo Lote
        </button>
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
            <input 
              type="text" 
              placeholder="Buscar lote o producto..."
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
                <th className="px-6 py-4">Costo Unitario</th>
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
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted font-medium">
                    No hay lotes registrados todavía.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
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
                      ${batch.unitCost.toLocaleString('es-CO')}
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
                          : batch.status === 'DEPLETED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {batch.status === 'IN_STOCK' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {batch.status === 'IN_STOCK' ? 'En Stock' : 'Agotado'}
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
          
          <div className="relative bg-surface w-full max-w-xl rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 border-b border-theme bg-primary text-base-color">
              <h2 className="text-2xl font-black">Nuevo Lote de Compra</h2>
              <p className="text-primary-foreground/70 font-medium text-sm mt-1">Ingresa los detalles de la recepción de mercancía.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Producto</label>
                  <select
                    required
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Proveedor</label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Cantidad Recibida</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.quantityReceived}
                    onChange={(e) => setFormData({ ...formData, quantityReceived: parseInt(e.target.value) })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Costo Unitario</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                      className="w-full bg-base border border-theme rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="col-span-full space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Fecha de Compra</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="date"
                      required
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full bg-base border border-theme rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-base border border-theme rounded-2xl font-bold text-muted hover:bg-theme/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] px-6 py-4 bg-primary text-base-color font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Confirmar Recepción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
