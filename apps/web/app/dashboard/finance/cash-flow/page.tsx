'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { parseISO, subDays, subMonths, isAfter } from 'date-fns';

interface CashFlowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
}

export default function CashFlowPage() {
  const [rawData, setRawData] = useState<CashFlowPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setRange] = useState('30_DAYS');
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  useEffect(() => {
    const fetchFlow = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/inventory/finance/cash-flow?period=${period}`);
        if (res.ok) {
          const result = await res.json();
          setRawData(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching cash flow:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFlow();
  }, [API_URL, period]);

  const filteredData = rawData.filter(point => {
    const date = period === 'daily' ? parseISO(point.label) : parseISO(`${point.label}-01`);
    const now = new Date();
    if (timeRange === '30_DAYS') return isAfter(date, subDays(now, 30));
    if (timeRange === '6_MONTHS') return isAfter(date, subMonths(now, 6));
    return true; // Year or All
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalIncome = filteredData.reduce((sum, p) => sum + p.income, 0);
  const totalExpense = filteredData.reduce((sum, p) => sum + p.expense, 0);
  const currentLiquidity = filteredData.length > 0 ? filteredData[filteredData.length - 1].balance : 0;

  if (loading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            Flujo de Caja (Cash Flow)
          </h1>
          <p className="text-muted font-medium">Monitoreo de liquidez y balance operativo en tiempo real.</p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-base border border-theme rounded-xl">
          {[
            { id: '30_DAYS', label: '30 días', period: 'daily' },
            { id: '6_MONTHS', label: '6 meses', period: 'monthly' },
            { id: 'YEAR', label: 'Año fiscal', period: 'monthly' }
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => { setRange(r.id); setPeriod(r.period as 'daily' | 'monthly'); }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                timeRange === r.id ? 'bg-primary text-base-color shadow-sm' : 'text-muted hover:bg-theme/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-theme rounded-3xl p-8 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Entradas</p>
            <h3 className="text-2xl font-black text-emerald-600">{formatCurrency(totalIncome)}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-500">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface border border-theme rounded-3xl p-8 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Salidas</p>
            <h3 className="text-2xl font-black text-rose-600">{formatCurrency(totalExpense)}</h3>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-primary text-base-color rounded-3xl p-8 flex items-center justify-between shadow-xl shadow-primary/20">
          <div>
            <p className="text-[10px] font-black text-base-color/60 uppercase tracking-widest mb-1">Liquidez Actual</p>
            <h3 className="text-2xl font-black">{formatCurrency(currentLiquidity)}</h3>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-primary">Análisis de Liquidez</h2>
          <p className="text-xs text-muted font-medium">Evolución del saldo acumulado vs flujo de caja neto.</p>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
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
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(val: number | undefined) => [formatCurrency(val || 0), '']}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#000000"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorBalance)"
                name="Saldo Acumulado"
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Entradas"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#f43f5e"
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Salidas"
              />
              <Legend verticalAlign="top" height={36}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-theme bg-base/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">Conciliación Mensual</h2>
          <div className="text-[10px] font-black text-muted uppercase tracking-widest bg-theme/10 px-3 py-1 rounded-full">
            Datos Consolidados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-8 py-4">Periodo</th>
                <th className="px-8 py-4">Ingresos (Ventas)</th>
                <th className="px-8 py-4">Egresos (Gastos + Stock)</th>
                <th className="px-8 py-4">Flujo Neto</th>
                <th className="px-8 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {[...filteredData].reverse().map((point) => (
                <tr key={point.label} className="hover:bg-primary/5 transition-colors group text-sm">
                  <td className="px-8 py-5 font-bold text-primary">
                    {point.label}
                  </td>
                  <td className="px-8 py-5 text-emerald-600 font-bold">
                    +{formatCurrency(point.income)}
                  </td>
                  <td className="px-8 py-5 text-rose-600 font-bold">
                    -{formatCurrency(point.expense)}
                  </td>
                  <td className={`px-8 py-5 font-black ${point.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {point.net >= 0 ? '+' : ''}{formatCurrency(point.net)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      point.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {point.net >= 0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {point.net >= 0 ? 'Positivo' : 'Déficit'}
                    </div>
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
