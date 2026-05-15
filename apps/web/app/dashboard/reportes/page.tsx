'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  TrendingUp,
  FileSpreadsheet,
  Signature,
  CheckCircle2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { getAuthHeaders as getSharedAuthHeaders } from '@/utils/supabase/auth';
import { apiFetch } from '@/utils/api';
import {
  formatApiConnectionErrorMessage,
  getApiResponseErrorMessage,
} from '@/lib/api-error';

interface ClosingReport {
  period: { startDate: string; endDate: string };
  pnl: {
    grossSales: number;
    totalCOGS: number;
    grossProfit: number;
    opexByCategory: Record<string, number>;
    totalOpex: number;
    estimatedTaxes: number;
    netProfit: number;
  };
  inventoryValuation: number;
}

interface AccountingReport {
  period: { startDate: string; endDate: string };
  totalIncome: number;
  totalOpex: number;
  totalCOGS: number;
  estimatedTaxes: number;
  netProfit: number;
  opexByCategory: Record<string, number>;
}

export default function ReportsPage() {
  const { role } = useDashboardAuth();
  const [report, setReport] = useState<ClosingReport | null>(null);
  const [accounting, setAccounting] = useState<AccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState('CURRENT_MONTH');

  const [dates, setDates] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const supabase = createClient();

  const hasCompleteDates = dates.start.length > 0 && dates.end.length > 0;
  const hasInvalidRange = hasCompleteDates && dates.start > dates.end;
  const rangeError = hasInvalidRange
    ? 'La fecha inicial no puede ser mayor que la fecha final.'
    : null;

  const getRequestAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Tu sesion expiro o no esta disponible. Inicia sesion nuevamente.');
    }

    return getSharedAuthHeaders();
  }, [supabase.auth]);

  const fetchReports = useCallback(async () => {
    if (role !== 'ADMIN') {
      setReport(null);
      setAccounting(null);
      setError('Solo los usuarios ADMIN pueden acceder a reportes contables.');
      setLoading(false);
      return;
    }

    if (!hasCompleteDates) {
      setReport(null);
      setAccounting(null);
      setLoading(false);
      return;
    }

    if (hasInvalidRange) {
      setReport(null);
      setAccounting(null);
      setError('La fecha inicial no puede ser mayor que la fecha final.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getRequestAuthHeaders();
      const [closingRes, accountingRes] = await Promise.all([
        apiFetch(`/inventory/reporting/closing?startDate=${dates.start}&endDate=${dates.end}`, {
          headers: authHeaders,
        }),
        apiFetch(`/inventory/reporting/accounting?startDate=${dates.start}&endDate=${dates.end}`, {
          headers: authHeaders,
        }),
      ]);

      if (closingRes.status === 401 || accountingRes.status === 401) {
        throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
      }

      if (closingRes.status === 403 || accountingRes.status === 403) {
        setReport(null);
        setAccounting(null);
        setError('Solo los usuarios ADMIN pueden acceder a reportes contables.');
        return;
      }

      const nextErrors: string[] = [];

      if (closingRes.ok) {
        const result = await closingRes.json();
        setReport(result.data || null);
      } else {
        setReport(null);
        nextErrors.push(
          await getApiResponseErrorMessage(
            closingRes,
            'No fue posible cargar el cierre contable.',
            'reportes contables',
          ),
        );
      }

      if (accountingRes.ok) {
        const result = await accountingRes.json();
        setAccounting(result.data || null);
      } else {
        setAccounting(null);
        nextErrors.push(
          await getApiResponseErrorMessage(
            accountingRes,
            'No fue posible cargar el reporte contable.',
            'reportes contables',
          ),
        );
      }

      if (nextErrors.length > 0) {
        const uniqueErrors = Array.from(new Set(nextErrors));
        setError(uniqueErrors.join(' '));
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'Solo los usuarios ADMIN pueden acceder a reportes contables.'
      ) {
        setReport(null);
        setAccounting(null);
        setError(err.message);
        return;
      }

      setReport(null);
      setAccounting(null);
      setError(
        err instanceof Error
          ? formatApiConnectionErrorMessage(err.message, 'reportes contables')
          : 'Ocurrio un error cargando los reportes contables.',
      );
    } finally {
      setLoading(false);
    }
  }, [dates, getRequestAuthHeaders, hasCompleteDates, hasInvalidRange, role]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    let start = new Date();
    let end = new Date();

    switch (newRange) {
      case 'CURRENT_MONTH':
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case 'LAST_MONTH':
        start = startOfMonth(subMonths(new Date(), 1));
        end = endOfMonth(subMonths(new Date(), 1));
        break;
      case 'YEAR_TO_DATE':
        start = startOfYear(new Date());
        end = new Date();
        break;
    }

    setDates({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    if (role !== 'ADMIN') {
      alert('Solo los usuarios ADMIN pueden exportar reportes contables.');
      return;
    }

    if (!hasCompleteDates || hasInvalidRange) {
      alert(rangeError || 'Selecciona un rango de fechas valido antes de exportar.');
      return;
    }

    setExportLoading(type);
    try {
      const authHeaders = await getRequestAuthHeaders();
      const res = await apiFetch(
        `/inventory/reporting/accounting/export/${type}?startDate=${dates.start}&endDate=${dates.end}`,
        {
        headers: authHeaders,
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
        }
        if (res.status === 403) {
          throw new Error('Solo los usuarios ADMIN pueden exportar reportes contables.');
        }

        const errorText = await res.text();
        throw new Error(errorText || `Error al exportar ${type.toUpperCase()}.`);
      }

      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Reporte_Contable_${dates.start}_${dates.end}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error(`Error exporting ${type}:`, err);
      alert(
        err instanceof Error
          ? err.message
          : `Error de red al exportar ${type.toUpperCase()}.`,
      );
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Reportes Contables</h1>
          </div>
          <p className="text-muted font-medium">Genera estados de resultados oficiales y valuación de activos.</p>
        </div>
        <div className="flex items-center gap-3">
           <button
             onClick={() => handleExport('excel')}
             disabled={exportLoading !== null || !hasCompleteDates || hasInvalidRange}
             className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
           >
             {exportLoading === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
             Excel
           </button>
           <button
             onClick={() => handleExport('pdf')}
             disabled={exportLoading !== null || !hasCompleteDates || hasInvalidRange}
             className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
           >
             {exportLoading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
             PDF
           </button>
        </div>
      </div>

      {/* Range Selector */}
      <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-2 p-1 bg-base border border-theme rounded-xl w-full md:w-auto">
          {['CURRENT_MONTH', 'LAST_MONTH', 'YEAR_TO_DATE'].map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                range === r ? 'bg-primary text-base-color shadow-sm' : 'text-muted hover:bg-theme/5'
              }`}
            >
              {r === 'CURRENT_MONTH' ? 'Este Mes' : r === 'LAST_MONTH' ? 'Mes Anterior' : 'Año Corrido'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-muted">
           <div className="flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             <input
               type="date"
               value={dates.start}
               onChange={(e) => setDates({ ...dates, start: e.target.value })}
               className="bg-transparent border-none p-0 text-sm font-bold outline-none text-primary"
             />
           </div>
           <span className="text-xs font-black">HASTA</span>
           <div className="flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             <input
               type="date"
               value={dates.end}
               onChange={(e) => setDates({ ...dates, end: e.target.value })}
               className="bg-transparent border-none p-0 text-sm font-bold outline-none text-primary"
             />
           </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-primary" />
           <p className="text-sm font-bold text-muted animate-pulse">Consolidando transacciones y lotes FIFO...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-widest text-rose-600">Acceso o carga fallida</p>
          <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Accounting Summary Cards */}
          {accounting && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Ingresos Totales</p>
                <h3 className="text-3xl font-black text-emerald-600">{formatCurrency(accounting.totalIncome)}</h3>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-500">
                  <ArrowUpRight className="w-4 h-4" />
                  Órdenes Pagadas/Entregadas
                </div>
              </div>

              <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Gastos Totales (OpEx + COGS)</p>
                <h3 className="text-3xl font-black text-rose-600">{formatCurrency(accounting.totalOpex + accounting.totalCOGS)}</h3>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-rose-500">
                  <ArrowDownRight className="w-4 h-4" />
                  Salidas de Efectivo
                </div>
              </div>

              <div className={`rounded-3xl p-8 shadow-xl shadow-primary/10 border border-theme ${accounting.netProfit >= 0 ? 'bg-primary text-base-color' : 'bg-rose-600 text-white'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${accounting.netProfit >= 0 ? 'text-base-color/60' : 'text-white/60'}`}>Utilidad Neta</p>
                <h3 className="text-3xl font-black">{formatCurrency(accounting.netProfit)}</h3>
                <div className={`mt-4 flex items-center gap-2 text-xs font-bold ${accounting.netProfit >= 0 ? 'text-base-color/80' : 'text-white/80'}`}>
                  {accounting.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  Resultado del Periodo
                </div>
              </div>
            </div>
          )}

          {/* Detailed Reports Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* P&L View */}
            {report && (
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-theme bg-base/30">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Estado de Resultados (P&L)
                    </h2>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-theme">
                      <tr className="bg-base/10">
                        <td className="px-8 py-4 font-bold text-primary">Ingresos Operacionales (Ventas)</td>
                        <td className="px-8 py-4 text-right font-black text-emerald-600">{formatCurrency(report.pnl.grossSales)}</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-4 text-muted font-medium flex items-center gap-2">
                          <ArrowDownRight className="w-4 h-4 text-rose-400" />
                          Costo de Ventas (COGS - FIFO)
                        </td>
                        <td className="px-8 py-4 text-right font-bold text-rose-500">-{formatCurrency(report.pnl.totalCOGS)}</td>
                      </tr>
                      <tr className="bg-primary/5">
                        <td className="px-8 py-4 font-black text-primary text-lg uppercase tracking-tight">Utilidad Bruta</td>
                        <td className="px-8 py-4 text-right font-black text-primary text-lg">{formatCurrency(report.pnl.grossProfit)}</td>
                      </tr>
                      {/* OpEx Breakdown Table as requested */}
                      <tr>
                        <td className="px-8 py-4 text-muted font-bold pt-6 pb-2 uppercase text-[10px] tracking-widest">Desglose de Gastos Operativos (OpEx)</td>
                        <td className="px-8 py-4"></td>
                      </tr>
                      {accounting ? (
                        Object.entries(accounting.opexByCategory).map(([cat, val]) => (
                          <tr key={cat}>
                            <td className="px-12 py-3 text-sm text-muted font-medium">{cat}</td>
                            <td className="px-8 py-3 text-right font-bold text-rose-500">-{formatCurrency(val)}</td>
                          </tr>
                        ))
                      ) : (
                        Object.entries(report.pnl.opexByCategory).map(([cat, val]) => (
                          <tr key={cat}>
                            <td className="px-12 py-3 text-sm text-muted font-medium">{cat}</td>
                            <td className="px-8 py-3 text-right font-bold text-rose-500">-{formatCurrency(val)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-rose-50/50">
                        <td className="px-8 py-4 font-bold text-rose-600">Total OpEx</td>
                        <td className="px-8 py-4 text-right font-black text-rose-600">-{formatCurrency(accounting?.totalOpex || report.pnl.totalOpex)}</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-4 text-muted font-medium italic">Impuestos Estimados (19%)</td>
                        <td className="px-8 py-4 text-right font-bold text-rose-500">-{formatCurrency(accounting?.estimatedTaxes || report.pnl.estimatedTaxes)}</td>
                      </tr>
                      <tr className="bg-black text-white">
                        <td className="px-8 py-6 font-black text-xl uppercase tracking-tighter">Utilidad Neta del Periodo</td>
                        <td className="px-8 py-6 text-right font-black text-xl">{formatCurrency(accounting?.netProfit || report.pnl.netProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Side Info */}
            <div className="space-y-8">
              {/* Inventory Valuation */}
              {report && (
                <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm group hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <PieChart className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-primary">Valor del Inventario</h3>
                  </div>
                  <p className="text-sm text-muted font-medium mb-4">Capital invertido actualmente en bodega (FIFO).</p>
                  <div className="text-3xl font-black text-primary">
                    {formatCurrency(report.inventoryValuation)}
                  </div>
                  <div className="mt-4 pt-4 border-t border-theme flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3" />
                    Activo Corriente Disponible
                  </div>
                </div>
              )}

              {/* Closing Checklist */}
              <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                  <Signature className="w-5 h-5 text-primary" />
                  Cierre Oficial
                </h3>
                <ul className="space-y-4">
                  {[
                    'Transacciones conciliadas',
                    'Lotes FIFO actualizados',
                    'Gastos OpEx registrados',
                    'Impuestos calculados'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-bold text-muted">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 p-4 bg-base rounded-2xl border border-dashed border-theme">
                  <p className="text-[10px] text-muted font-medium italic text-center">
                    Reporte generado electrónicamente. Los valores están sujetos a auditoría externa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
