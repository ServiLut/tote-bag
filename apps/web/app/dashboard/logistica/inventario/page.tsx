'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Boxes,
  ChevronDown,
  ChevronRight,
  Download,
  Factory,
  FileSpreadsheet,
  History,
  Layers,
  Loader2,
  Package,
  ScrollText,
  Search,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

type InventoryBatch = {
  id: string;
  lineId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  status: string;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
  } | null;
};

type InventoryProduct = {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  totalStock: number;
  stockPhysical?: number;
  stockCommitted?: number;
  stockAvailable?: number;
  totalValuation: number;
  weightedAvgCost: number;
  batches: InventoryBatch[];
};

type InventoryMovement = {
  id: string;
  action?: string;
  entity?: string;
  entityId?: string | null;
  reason?: string;
  itemType?: string;
  quantity?: number;
  balanceAfter?: number;
  variant?: {
    sku?: string | null;
    product?: { name?: string | null } | null;
  } | null;
  supplyItem?: {
    name?: string | null;
    sku?: string | null;
  } | null;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};

type ReorderAlert = {
  itemType: 'VARIANT' | 'SUPPLY';
  id: string;
  sku?: string | null;
  name: string;
  stockPhysical: number;
  stockCommitted: number;
  stockAvailable: number;
  reorderPoint: number;
  unitOfMeasure?: string;
};

type ReorderAlertsResponse = {
  count: number;
  variants: ReorderAlert[];
  supplies: ReorderAlert[];
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUnits(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getDownloadFilename(
  contentDisposition: string | null,
  fallback: string,
) {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

export default function InventoryDashboardPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<ReorderAlertsResponse>({
    count: 0,
    variants: [],
    supplies: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'movements'>('current');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [weightedCostMin, setWeightedCostMin] = useState('');
  const [weightedCostMax, setWeightedCostMax] = useState('');
  const [inventoryValueMin, setInventoryValueMin] = useState('');
  const [inventoryValueMax, setInventoryValueMax] = useState('');
  const [batchCountMin, setBatchCountMin] = useState('');
  const [batchCountMax, setBatchCountMax] = useState('');
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);

  useEffect(() => {
    let active = true;

    const loadInventory = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const [inventoryRes, movementsRes, reorderRes] = await Promise.all([
          apiFetch('/inventory/detailed', { headers }),
          apiFetch('/inventory/movements', { headers }),
          apiFetch('/inventory/reorder-alerts', { headers }),
        ]);

        if (!active) {
          return;
        }

        const [inventoryBody, movementsBody, reorderBody] = await Promise.all([
          inventoryRes.ok ? inventoryRes.json() : Promise.resolve([]),
          movementsRes.ok ? movementsRes.json() : Promise.resolve([]),
          reorderRes.ok
            ? reorderRes.json()
            : Promise.resolve({ count: 0, variants: [], supplies: [] }),
        ]);

        setProducts(inventoryBody.data || inventoryBody || []);
        setMovements(movementsBody.data || movementsBody || []);
        setReorderAlerts(reorderBody.data || reorderBody);

        if (!inventoryRes.ok || !movementsRes.ok || !reorderRes.ok) {
          setError('La vista cargo parcialmente. Algunos datos de inventario no estuvieron disponibles.');
        }
      } catch (fetchError) {
        console.error('Error loading inventory dashboard:', fetchError);
        if (!active) {
          return;
        }

        setProducts([]);
        setMovements([]);
        setReorderAlerts({ count: 0, variants: [], supplies: [] });
        setError('No fue posible conectar con la API de inventario.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInventory();

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.skus += 1;
        acc.units += product.totalStock;
        acc.committed += product.stockCommitted ?? 0;
        acc.available += product.stockAvailable ?? product.totalStock;
        acc.valuation += product.totalValuation;
        acc.batches += product.batches.length;
        return acc;
      },
      { skus: 0, units: 0, committed: 0, available: 0, valuation: 0, batches: 0 },
    );
  }, [products]);

  const allReorderAlerts = useMemo(
    () => [...reorderAlerts.variants, ...reorderAlerts.supplies],
    [reorderAlerts],
  );

  const topProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.totalValuation - a.totalValuation)
        .filter((product) => {
          const term = search.trim().toLowerCase();
          const weightedCost = product.weightedAvgCost;
          const inventoryValue = product.totalValuation;
          const batchCount = product.batches.length;
          const weightedCostMinValue = weightedCostMin ? Number(weightedCostMin) : null;
          const weightedCostMaxValue = weightedCostMax ? Number(weightedCostMax) : null;
          const inventoryValueMinValue = inventoryValueMin ? Number(inventoryValueMin) : null;
          const inventoryValueMaxValue = inventoryValueMax ? Number(inventoryValueMax) : null;
          const batchCountMinValue = batchCountMin ? Number(batchCountMin) : null;
          const batchCountMaxValue = batchCountMax ? Number(batchCountMax) : null;

          if (weightedCostMinValue !== null && weightedCost < weightedCostMinValue) {
            return false;
          }

          if (weightedCostMaxValue !== null && weightedCost > weightedCostMaxValue) {
            return false;
          }

          if (inventoryValueMinValue !== null && inventoryValue < inventoryValueMinValue) {
            return false;
          }

          if (inventoryValueMaxValue !== null && inventoryValue > inventoryValueMaxValue) {
            return false;
          }

          if (batchCountMinValue !== null && batchCount < batchCountMinValue) {
            return false;
          }

          if (batchCountMaxValue !== null && batchCount > batchCountMaxValue) {
            return false;
          }

          if (!term) {
            return true;
          }

          return (
            product.name.toLowerCase().includes(term) ||
            product.slug.toLowerCase().includes(term)
          );
        }),
    [
      batchCountMax,
      batchCountMin,
      inventoryValueMax,
      inventoryValueMin,
      products,
      search,
      weightedCostMax,
      weightedCostMin,
    ],
  );

  const toggleRow = (productId: string) => {
    setExpandedRows((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExportLoading(type);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch(`/inventory/reporting/fifo/export/${type}`, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `No fue posible exportar el reporte en ${type.toUpperCase()}.`,
        );
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = getDownloadFilename(
        response.headers.get('Content-Disposition'),
        `Reporte_Inventario_FIFO.${type === 'excel' ? 'xlsx' : 'pdf'}`,
      );
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(link);
    } catch (exportError) {
      console.error(`Error exporting FIFO report (${type}):`, exportError);
      setError(
        exportError instanceof Error
          ? exportError.message
          : `No fue posible exportar el reporte en ${type.toUpperCase()}.`,
      );
    } finally {
      setExportLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted">Cargando inventario FIFO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
              <Layers className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Inventario FIFO Detallado
            </h1>
          </div>
          <p className="font-medium text-muted">
            Control de capas de costo, valoracion de activos y rotacion de lotes.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleExport('excel')}
              disabled={exportLoading !== null}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportLoading === 'excel' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </button>
            <button
              type="button"
              onClick={() => void handleExport('pdf')}
              disabled={exportLoading !== null}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportLoading === 'pdf' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-theme bg-base p-1">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'current'
                  ? 'bg-primary text-base-color shadow-sm'
                  : 'text-muted hover:bg-theme/5'
              }`}
            >
              Inventario Actual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'movements'
                  ? 'bg-primary text-base-color shadow-sm'
                  : 'text-muted hover:bg-theme/5'
              }`}
            >
              Movimientos
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'current' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Buscar por nombre de producto o SKU..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-theme bg-surface py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <input
                type="number"
                min="0"
                placeholder="Costo prom. min"
                value={weightedCostMin}
                onChange={(event) => setWeightedCostMin(event.target.value)}
                className="w-full rounded-2xl border border-theme bg-surface px-4 py-4 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="number"
                min="0"
                placeholder="Costo prom. max"
                value={weightedCostMax}
                onChange={(event) => setWeightedCostMax(event.target.value)}
                className="w-full rounded-2xl border border-theme bg-surface px-4 py-4 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <MetricCard
              label="Valor Total Activos"
              value={formatCurrency(totals.valuation)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="emerald"
            />
            <MetricCard
              label="Stock Disponible"
              value={`${formatUnits(totals.available)} und`}
              icon={<Package className="h-5 w-5" />}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="number"
              min="0"
              placeholder="Valor inventario min"
              value={inventoryValueMin}
              onChange={(event) => setInventoryValueMin(event.target.value)}
              className="w-full rounded-2xl border border-theme bg-surface px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              min="0"
              placeholder="Valor inventario max"
              value={inventoryValueMax}
              onChange={(event) => setInventoryValueMax(event.target.value)}
              className="w-full rounded-2xl border border-theme bg-surface px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              min="0"
              placeholder="Lotes min"
              value={batchCountMin}
              onChange={(event) => setBatchCountMin(event.target.value)}
              className="w-full rounded-2xl border border-theme bg-surface px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              min="0"
              placeholder="Lotes max"
              value={batchCountMax}
              onChange={(event) => setBatchCountMax(event.target.value)}
              className="w-full rounded-2xl border border-theme bg-surface px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          {allReorderAlerts.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-4 flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Alertas de reabastecimiento
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {allReorderAlerts.slice(0, 6).map((alert) => (
                  <div
                    key={`${alert.itemType}-${alert.id}`}
                    className="rounded-lg border border-amber-200 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-black text-primary">{alert.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                      {alert.itemType === 'VARIANT' ? 'Variante' : 'Insumo'}
                      {alert.sku ? ` | ${alert.sku}` : ''}
                    </p>
                    <p className="mt-2 text-xs font-bold text-muted">
                      Disponible {formatUnits(alert.stockAvailable)} / Reorden{' '}
                      {formatUnits(alert.reorderPoint)}
                      {alert.unitOfMeasure ? ` ${alert.unitOfMeasure}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/30 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-8 py-4">Producto</th>
                  <th className="px-8 py-4">Stock Disponible</th>
                  <th className="px-8 py-4">Costo Ponderado</th>
                  <th className="px-8 py-4">Valor Inventario</th>
                  <th className="px-8 py-4 text-right">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-14">
                      <EmptyState message="No hay productos con lotes disponibles en inventario." />
                    </td>
                  </tr>
                ) : (
                  topProducts.map((product) => {
                    const isExpanded = expandedRows.includes(product.id);
                    const stockPhysical = product.stockPhysical ?? product.totalStock;
                    const stockCommitted = product.stockCommitted ?? 0;
                    const stockAvailable = product.stockAvailable ?? product.totalStock;
                    const isLowStock = allReorderAlerts.some(
                      (alert) => alert.name === product.name,
                    );

                    return (
                      <Fragment key={product.id}>
                        <tr
                          className={`cursor-pointer transition-all hover:bg-primary/5 ${
                            isExpanded ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => toggleRow(product.id)}
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl border border-theme bg-base">
                                {product.image ? (
                                  <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted">
                                    <Package className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-primary">{product.name}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                                  {product.slug}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-base font-black ${
                                  isLowStock ? 'text-rose-600' : 'text-primary'
                                }`}
                              >
                                {formatUnits(stockAvailable)}
                              </span>
                              {isLowStock ? (
                                <span className="rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-rose-600">
                                  Reorden
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                              Fisico {formatUnits(stockPhysical)} | Comprometido{' '}
                              {formatUnits(stockCommitted)}
                            </p>
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
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="bg-base/20">
                            <td colSpan={5} className="px-12 py-6">
                              <div className="overflow-hidden rounded-2xl border border-theme bg-surface">
                                <table className="w-full border-collapse text-left">
                                  <thead className="bg-base/50">
                                    <tr className="border-b border-theme text-[9px] font-black uppercase tracking-widest text-muted/50">
                                      <th className="px-6 py-3">Lote / Linea</th>
                                      <th className="px-6 py-3">Ingreso</th>
                                      <th className="px-6 py-3">Cant. Inicial</th>
                                      <th className="px-6 py-3">Disponible</th>
                                      <th className="px-6 py-3">Costo Unit.</th>
                                      <th className="px-6 py-3">Proveedor</th>
                                      <th className="px-6 py-3 text-right">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-theme">
                                    {product.batches.map((batch) => {
                                      const isStale =
                                        Date.now() - new Date(batch.createdAt).getTime() >
                                        1000 * 60 * 60 * 24 * 60;

                                      return (
                                        <tr
                                          key={batch.lineId}
                                          className="text-xs transition-colors hover:bg-base/30"
                                        >
                                          <td className="px-6 py-4 font-mono text-[10px] text-muted">
                                            <div className="flex flex-col gap-1">
                                              <span>Lote {batch.id.substring(0, 8)}</span>
                                              <span>Linea {batch.lineId.substring(0, 8)}</span>
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 font-bold text-primary">
                                            {formatDate(batch.createdAt)}
                                          </td>
                                          <td className="px-6 py-4 text-muted">
                                            {formatUnits(batch.quantityReceived)}
                                          </td>
                                          <td className="px-6 py-4 font-black text-primary">
                                            {formatUnits(batch.quantityRemaining)}
                                          </td>
                                          <td className="px-6 py-4 font-bold text-primary">
                                            {formatCurrency(batch.unitCost)}
                                          </td>
                                          <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 font-medium text-muted">
                                              <Truck className="h-3 w-3" />
                                              {batch.supplier?.name || 'Proveedor no disponible'}
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                            {isStale ? (
                                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-600">
                                                <AlertCircle className="h-3 w-3" />
                                                Lote Estancado
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-black uppercase text-emerald-600">
                                                Saludable
                                              </span>
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
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <SecondaryMetricCard
              label="Stock fisico"
              value={formatUnits(totals.units)}
              icon={<Boxes className="h-5 w-5" />}
            />
            <SecondaryMetricCard
              label="Stock comprometido"
              value={formatUnits(totals.committed)}
              icon={<Package className="h-5 w-5" />}
            />
            <SecondaryMetricCard
              label="Alertas reorden"
              value={formatUnits(reorderAlerts.count)}
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <SecondaryMetricCard
              label="Productos activos"
              value={String(totals.skus)}
              icon={<Boxes className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <SecondaryMetricCard
              label="Lotes en stock"
              value={formatUnits(totals.batches)}
              icon={<ScrollText className="h-5 w-5" />}
            />
            <SecondaryMetricCard
              label="Costo acumulado"
              value={formatCurrency(
                topProducts.reduce((sum, product) => sum + product.weightedAvgCost, 0),
              )}
              icon={<Factory className="h-5 w-5" />}
            />
            <SecondaryMetricCard
              label="Items visibles"
              value={formatUnits(topProducts.length)}
              icon={<Archive className="h-5 w-5" />}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
          <div className="flex items-center gap-3 border-b border-theme bg-base/30 p-8">
            <History className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-primary">Historial de Consumo FIFO</h2>
          </div>

          {error ? (
            <div className="border-b border-theme bg-rose-50 px-8 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-8 py-4">Fecha/Hora</th>
                  <th className="px-8 py-4">Accion</th>
                  <th className="px-8 py-4">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-14">
                      <EmptyState message="No hay movimientos recientes de inventario." />
                    </td>
                  </tr>
                ) : (
                  movements.slice(0, 20).map((movement) => {
                    const movementLabel = movement.reason || movement.action || 'MOVIMIENTO';
                    const itemName =
                      movement.variant?.product?.name ||
                      movement.variant?.sku ||
                      movement.supplyItem?.name ||
                      movement.supplyItem?.sku ||
                      movement.entity ||
                      'Inventario';
                    const quantity =
                      typeof movement.quantity === 'number'
                        ? movement.quantity
                        : Number(movement.payload?.quantityReduced || 0);

                    return (
                      <tr key={movement.id} className="text-sm transition-colors hover:bg-primary/5">
                        <td className="px-8 py-5 font-medium text-muted">
                          {formatDate(movement.createdAt)}
                        </td>
                        <td className="px-8 py-5">
                          <span className="rounded-full border border-theme bg-theme/50 px-3 py-1 text-[10px] font-black uppercase text-primary">
                            {movementLabel}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3 font-bold text-primary">
                            <ArrowRight className="h-4 w-4 text-rose-500" />
                            {itemName}
                          </div>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                            Cantidad {formatUnits(quantity)} | Saldo{' '}
                            {formatUnits(movement.balanceAfter ?? 0)}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
      <div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</p>
        <h3 className="text-lg font-black text-primary">{value}</h3>
      </div>
    </div>
  );
}

function SecondaryMetricCard({
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-theme bg-base/20 px-6 py-10 text-center text-sm italic text-muted">
      {message}
    </div>
  );
}
