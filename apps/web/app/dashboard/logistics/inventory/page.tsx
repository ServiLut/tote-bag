'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Image from 'next/image';
import {
  Package,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  History,
  Layers,
  TrendingUp,
  Truck,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

interface Batch {
  id: string;
  createdAt: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  supplier: { name: string };
}

interface ProductInventory {
  id: string;
  name: string;
  slug: string;
  image?: string;
  totalStock: number;
  totalValuation: number;
  weightedAvgCost: number;
  batches: Batch[];
}

interface Movement {
  id: string;
  createdAt: string;
  action: string;
  entityId?: string;
  payload: unknown;
  user: { email: string };
}

export default function InventoryFIFOPage() {
  const [inventory, setInventory] = useState<ProductInventory[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'movements'>('current');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const [invRes, movRes] = await Promise.all([
        apiFetch('/inventory/detailed', { headers }),
        apiFetch('/inventory/movements', { headers }),
      ]);
      if (invRes.ok) {
        const result = await invRes.json();
        setInventory(result.data || []);
      }
      if (movRes.ok) {
        const result = await movRes.json();
        setMovements(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredInventory = inventory.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-xl text-white">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Inventario FIFO Detallado</h1>
          </div>
          <p className="text-muted font-medium">Control de capas de costo, valoración de activos y rotación de lotes.</p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-base border border-theme rounded-xl">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'current' ? 'bg-primary text-base-color shadow-sm' : 'text-muted hover:bg-theme/5'
            }`}
          >
            Inventario Actual
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'movements' ? 'bg-primary text-base-color shadow-sm' : 'text-muted hover:bg-theme/5'
            }`}
          >
            Movimientos (Logs)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted animate-pulse">Analizando lotes y capas de costo...</p>
        </div>
      ) : activeTab === 'current' ? (
        <div className="space-y-6">
          {/* Search & KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                placeholder="Buscar por nombre de producto o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-surface border border-theme rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
            <div className="bg-surface border border-theme rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Valor Total Activos</p>
                <p className="text-lg font-black text-primary">
                  {formatCurrency(inventory.reduce((sum, p) => sum + p.totalValuation, 0))}
                </p>
              </div>
            </div>
            <div className="bg-surface border border-theme rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Stock Total</p>
                <p className="text-lg font-black text-primary">
                  {inventory.reduce((sum, p) => sum + p.totalStock, 0).toLocaleString()} <span className="text-xs">unidades</span>
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-base/30 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                  <th className="px-8 py-4">Producto</th>
                  <th className="px-8 py-4">Stock Disponible</th>
                  <th className="px-8 py-4">Costo Ponderado</th>
                  <th className="px-8 py-4">Valor Inventario</th>
                  <th className="px-8 py-4 text-right">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredInventory.map((product) => {
                  const isExpanded = expandedRows.includes(product.id);
                  const isLowStock = product.totalStock < 10;

                  return (
                    <Fragment key={product.id}>
                      <tr
                        key={product.id}
                        className={`hover:bg-primary/5 transition-all cursor-pointer ${isExpanded ? 'bg-primary/5' : ''}`}
                        onClick={() => toggleRow(product.id)}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-base border border-theme overflow-hidden flex-none relative">
                              {product.image ? (
                                <Image src={product.image} alt={product.name} fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted"><Package className="w-5 h-5" /></div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-primary">{product.name}</span>
                              <span className="text-[10px] font-black text-muted uppercase tracking-widest">{product.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-black ${isLowStock ? 'text-rose-600' : 'text-primary'}`}>
                              {product.totalStock}
                            </span>
                            {isLowStock && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-tighter border border-rose-100">Stock Bajo</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-muted">
                          {formatCurrency(product.weightedAvgCost)}
                        </td>
                        <td className="px-8 py-5 font-black text-primary">
                          {formatCurrency(product.totalValuation)}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 text-xs font-bold text-muted">
                            {product.batches.length} activos
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-base/20">
                          <td colSpan={5} className="px-12 py-6">
                            <div className="bg-surface border border-theme rounded-2xl overflow-hidden">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-base/50">
                                  <tr className="text-[9px] uppercase tracking-widest font-black text-muted/50 border-b border-theme">
                                    <th className="px-6 py-3">Lote ID</th>
                                    <th className="px-6 py-3">Ingreso</th>
                                    <th className="px-6 py-3">Cant. Inicial</th>
                                    <th className="px-6 py-3">Disponible</th>
                                    <th className="px-6 py-3">Costo Unit.</th>
                                    <th className="px-6 py-3">Proveedor</th>
                                    <th className="px-6 py-3 text-right">Estado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-theme">
                                  {product.batches.map(batch => {
                                    const staleDays = differenceInDays(new Date(), new Date(batch.createdAt));
                                    const isStale = staleDays > 60;

                                    return (
                                      <tr key={batch.id} className="text-xs hover:bg-base/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-[10px] text-muted">{batch.id.substring(0, 8)}</td>
                                        <td className="px-6 py-4 font-bold text-primary">{format(new Date(batch.createdAt), 'dd/MM/yyyy')}</td>
                                        <td className="px-6 py-4 text-muted">{batch.quantityReceived}</td>
                                        <td className="px-6 py-4 font-black text-primary">{batch.quantityRemaining}</td>
                                        <td className="px-6 py-4 font-bold text-primary">{formatCurrency(batch.unitCost)}</td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-2 text-muted font-medium">
                                            <Truck className="w-3 h-3" />
                                            {batch.supplier?.name}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          {isStale ? (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase border border-amber-100">
                                              <AlertCircle className="w-3 h-3" />
                                              Lote Estancado (+60d)
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-black text-emerald-600 uppercase">Saludable</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movements Tab */
        <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
          <div className="p-8 border-b border-theme bg-base/30 flex items-center gap-3">
            <History className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-primary">Historial de Consumo FIFO</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                  <th className="px-8 py-4">Fecha/Hora</th>
                  <th className="px-8 py-4">Acción</th>
                  <th className="px-8 py-4">Detalle de Consumo</th>
                  <th className="px-8 py-4">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {movements.map((mov) => {
                  const payload = mov.payload as { quantityReduced?: number; unitCost?: number };
                  return (
                    <tr key={mov.id} className="hover:bg-primary/5 transition-colors text-sm">
                      <td className="px-8 py-5 text-muted font-medium">
                        {format(new Date(mov.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 rounded-full bg-theme/50 text-[10px] font-black uppercase text-primary border border-theme">
                          {mov.action}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3 font-bold text-primary">
                          <ArrowRight className="w-4 h-4 text-rose-500" />
                          Se descontaron {payload?.quantityReduced} unidades @ {formatCurrency(payload?.unitCost || 0)}
                        </div>
                        <p className="text-[10px] text-muted font-medium mt-1 uppercase tracking-wider">
                          Lote afectado: {mov.entityId?.substring(0, 8)}...
                        </p>
                      </td>
                      <td className="px-8 py-5 text-xs text-muted font-medium">
                        {mov.user?.email || 'Sistema'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
