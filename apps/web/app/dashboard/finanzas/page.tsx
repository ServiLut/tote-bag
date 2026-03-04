'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FinancialSummary {
  kpis: {
    totalIncome: number;
    totalOpex: number;
    totalPurchases: number;
    totalCOGS: number;
  };
  cashFlowChart: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    category: string;
    amount: number;
    description: string;
    status: string;
    createdAt: string;
  }>;
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${API_URL}/inventory/finance/summary`);
        if (res.ok) {
          const result = await res.json();
          setData(result.data || null);
        }
      } catch (err) {
        console.error('Error fetching financial summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [API_URL]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const netProfit = data ? data.kpis.totalIncome - data.kpis.totalCOGS - data.kpis.totalOpex : 0;
  const filteredTransactions = data?.recentTransactions.filter(tx =>
    filterCategory === 'ALL' || tx.category === filterCategory
  ) || [];

  if (loading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted font-bold animate-bounce">Calculando estados financieros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
            <PieChart className="w-8 h-8 text-primary" />
            Dashboard Financiero
          </h1>
          <p className="text-muted font-medium">Análisis de rentabilidad, flujo de caja y control de gastos operativos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-base border border-theme rounded-xl text-xs font-bold text-muted hover:text-primary transition-all">
            <Calendar className="w-4 h-4" />
            Últimos 30 días
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-base-color rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
            <Download className="w-4 h-4" />
            Exportar Reporte
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Income Card */}
        <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-wider">+12% vs mes ant.</span>
          </div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Ingresos Totales</p>
          <h3 className="text-2xl font-black text-primary mt-1">{formatCurrency(data?.kpis.totalIncome || 0)}</h3>
        </div>

        {/* COGS Card */}
        <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Costo de Venta (COGS)</p>
          <h3 className="text-2xl font-black text-primary mt-1">{formatCurrency(data?.kpis.totalCOGS || 0)}</h3>
        </div>

        {/* OpEx Card */}
        <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Gastos OpEx</p>
          <h3 className="text-2xl font-black text-primary mt-1">{formatCurrency(data?.kpis.totalOpex || 0)}</h3>
        </div>

        {/* Net Profit Card */}
        <div className={`bg-surface border border-theme rounded-2xl p-6 shadow-sm group transition-all ${netProfit >= 0 ? 'hover:border-emerald-300' : 'hover:border-rose-300'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              Rentabilidad: {(data ? (netProfit / data.kpis.totalIncome) * 100 : 0).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Utilidad Neta</p>
          <h3 className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(netProfit)}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-surface border border-theme rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-primary">Flujo de Caja (Cash Flow)</h2>
              <p className="text-xs text-muted font-medium">Comparativa mensual de entradas vs salidas de capital.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary/30 rounded-full" />
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Salidas</span>
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.cashFlowChart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                  tickFormatter={(val) => `$${val/1000000}M`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(val: number | undefined) => [formatCurrency(val || 0), '']}
                />
                <Bar dataKey="income" name="Entradas" fill="#000000" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="expense" name="Salidas" fill="#00000033" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Distribution / Extra Column */}
        <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm flex flex-col">
          <h2 className="text-xl font-bold text-primary mb-2">Resumen de Egresos</h2>
          <p className="text-xs text-muted font-medium mb-8">Distribución de gastos acumulados.</p>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-muted">Compras de Mercancía</span>
                <span className="text-primary">{((data?.kpis.totalPurchases || 0) / (data?.kpis.totalPurchases || 1 + (data?.kpis.totalOpex || 0)) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-base rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${((data?.kpis.totalPurchases || 0) / (data?.kpis.totalPurchases || 1 + (data?.kpis.totalOpex || 0)) * 100)}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-muted">Gastos Operativos (OpEx)</span>
                <span className="text-primary">{((data?.kpis.totalOpex || 0) / (data?.kpis.totalPurchases || 1 + (data?.kpis.totalOpex || 0)) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-base rounded-full overflow-hidden">
                <div className="h-full bg-primary/30" style={{ width: `${((data?.kpis.totalOpex || 0) / (data?.kpis.totalPurchases || 1 + (data?.kpis.totalOpex || 0)) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
            <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-1">Ratio de Eficiencia</h4>
            <p className="text-2xl font-black text-primary">
              {(data ? (data.kpis.totalOpex / data.kpis.totalIncome) * 100 : 0).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted font-medium mt-1">Por cada $1.000 generados, $X se destinan a operación.</p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-theme bg-base/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <Receipt className="w-6 h-6 text-primary" />
             <h2 className="text-xl font-bold text-primary">Transacciones Recientes</h2>
          </div>
          <div className="flex items-center gap-2">
             <Filter className="w-4 h-4 text-muted" />
             <select
               value={filterCategory}
               onChange={(e) => setFilterCategory(e.target.value)}
               className="bg-base border border-theme rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all"
             >
               <option value="ALL">Todas las Categorías</option>
               <option value="SALE">Ventas (B2C/B2B)</option>
               <option value="PURCHASE">Compra de Material</option>
               <option value="OPEX">Gastos Oficina</option>
               <option value="PAYROLL">Nómina</option>
             </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-8 py-4">Fecha</th>
                <th className="px-8 py-4">Descripción</th>
                <th className="px-8 py-4">Categoría</th>
                <th className="px-8 py-4">Tipo</th>
                <th className="px-8 py-4">Monto</th>
                <th className="px-8 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-primary/5 transition-colors group text-sm">
                  <td className="px-8 py-5 font-medium text-muted">
                    {format(new Date(tx.createdAt), 'dd MMM, yyyy', { locale: es })}
                  </td>
                  <td className="px-8 py-5 font-bold text-primary max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted/70 bg-theme/10 px-2 py-1 rounded-md">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {tx.type === 'INCOME' ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-rose-500" />
                      )}
                      <span className={`font-black uppercase text-[10px] tracking-widest ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'INCOME' ? 'Entrada' : 'Salida'}
                      </span>
                    </div>
                  </td>
                  <td className={`px-8 py-5 font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-primary'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                      <CheckCircleIcon className="w-3 h-3" />
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
