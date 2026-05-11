'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import { FINANCE_DATA_CHANGED_EVENT } from '@/lib/finance-events';
import { buildCashFlowDateRange } from '@/lib/cash-flow-range';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { apiFetch } from '@/utils/api';

type CashFlowPeriod = 'daily' | 'monthly';
type CashFlowRange = '30_DAYS' | '6_MONTHS' | 'YEAR';

type CashFlowPoint = {
  label: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
};

type FinancialSummary = {
  kpis: {
    totalIncome: number;
    totalOpex: number;
    totalPurchases: number;
    totalCOGS: number | null;
  };
};

const supabase = createClient();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyOrUnavailable(amount: number | null) {
  return amount === null ? 'No disponible' : formatCurrency(amount);
}

export default function CashFlowPage() {
  const { accessToken } = useDashboardAuth();
  const [period, setPeriod] = useState<CashFlowPeriod>('daily');
  const [timeRange, setTimeRange] = useState<CashFlowRange>('30_DAYS');
  const [points, setPoints] = useState<CashFlowPoint[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const range = useMemo(() => {
    return buildCashFlowDateRange(timeRange);
  }, [timeRange]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token ?? accessToken;
    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [accessToken]);

  const loadCashFlow = useCallback(async (activeRef?: { current: boolean }) => {
    const isActive = () => activeRef?.current ?? true;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [cashFlowRes, summaryRes] = await Promise.all([
        apiFetch(
          `/inventory/finance/cash-flow?period=${period}&startDate=${range.startDate}&endDate=${range.endDate}`,
          { headers },
        ),
        apiFetch(
          `/inventory/finance/summary?startDate=${range.startDate}&endDate=${range.endDate}`,
          { headers },
        ),
      ]);

      if (!isActive()) {
        return;
      }

      if (!cashFlowRes.ok || !summaryRes.ok) {
        const status = !cashFlowRes.ok ? cashFlowRes.status : summaryRes.status;
        setLoadError(
          status === 401 || status === 403
            ? 'Tu sesion no tiene permisos para consultar flujo de caja.'
            : `No fue posible cargar el flujo de caja (${status}).`,
        );
      } else {
        setLoadError(null);
      }

      if (cashFlowRes.ok) {
        const body = await cashFlowRes.json();
        setPoints(Array.isArray(body.data) ? body.data : []);
      } else {
        setPoints([]);
      }

      if (summaryRes.ok) {
        const body = await summaryRes.json();
        setSummary(body.data || null);
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error('Error loading cash flow:', error);
      if (isActive()) {
        setLoadError('No fue posible conectar con la API financiera.');
        setPoints([]);
        setSummary(null);
      }
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, [getAuthHeaders, period, range.endDate, range.startDate]);

  useEffect(() => {
    const activeRef = { current: true };

    void loadCashFlow(activeRef);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!(session?.access_token ?? accessToken)) {
          setPoints([]);
          setSummary(null);
          setLoadError(null);
          setLoading(false);
          return;
        }

        void loadCashFlow(activeRef);
      },
    );

    return () => {
      activeRef.current = false;
      subscription.unsubscribe();
    };
  }, [accessToken, loadCashFlow]);

  useEffect(() => {
    const triggerReload = () => {
      if (document.visibilityState === 'visible') {
        void loadCashFlow();
      }
    };

    const handleFinanceDataChanged = () => {
      void loadCashFlow();
    };

    window.addEventListener('focus', triggerReload);
    document.addEventListener('visibilitychange', triggerReload);
    window.addEventListener(FINANCE_DATA_CHANGED_EVENT, handleFinanceDataChanged);

    return () => {
      window.removeEventListener('focus', triggerReload);
      document.removeEventListener('visibilitychange', triggerReload);
      window.removeEventListener(FINANCE_DATA_CHANGED_EVENT, handleFinanceDataChanged);
    };
  }, [loadCashFlow]);

  const latestPoint = points.at(-1);

  const totals = useMemo(() => {
    return points.reduce(
      (acc, point) => {
        acc.income += point.income;
        acc.expense += point.expense;
        acc.net += point.net;
        return acc;
      },
      { income: 0, expense: 0, net: 0 },
    );
  }, [points]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-primary">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            Flujo de Caja (Cash Flow)
          </h1>
          <p className="font-medium text-muted">
            Monitoreo de liquidez y balance operativo en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-theme bg-base p-1">
          {[
            { id: '30_DAYS', label: '30 dias', period: 'daily' },
            { id: '6_MONTHS', label: '6 meses', period: 'monthly' },
            { id: 'YEAR', label: 'Ano fiscal', period: 'monthly' },
          ].map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => {
                setTimeRange(range.id as CashFlowRange);
                setPeriod(range.period as CashFlowPeriod);
              }}
              className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                timeRange === range.id
                  ? 'bg-primary text-base-color shadow-sm'
                  : 'text-muted hover:bg-theme/5'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricBanner
          label="Entradas"
          value={formatCurrency(totals.income)}
          tone="emerald"
          icon={<ArrowUpRight className="h-6 w-6" />}
        />
        <MetricBanner
          label="Salidas"
          value={formatCurrency(totals.expense)}
          tone="rose"
          icon={<ArrowDownRight className="h-6 w-6" />}
        />
        <div className="flex items-center justify-between rounded-3xl bg-primary p-8 text-base-color shadow-xl shadow-primary/20">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-base-color/60">
              Flujo Acumulado
            </p>
            <h3 className="text-2xl font-black">
              {formatCurrency(latestPoint?.balance || 0)}
            </h3>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-primary">Analisis de Liquidez</h2>
          <p className="text-xs font-medium text-muted">
            Evolucion del saldo acumulado vs flujo de caja neto.
          </p>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0} />
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
                tickFormatter={(value) => `$${Math.round(Number(value) / 1000000)}M`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '16px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number | undefined, name?: string) => [
                  formatCurrency(value || 0),
                  name === 'balance'
                    ? 'Saldo acumulado'
                    : name === 'income'
                      ? 'Entradas'
                      : 'Salidas',
                ]}
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
              <Legend verticalAlign="top" height={36} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-theme bg-base/30 p-8">
          <h2 className="text-xl font-bold text-primary">Conciliacion</h2>
          <div className="rounded-full bg-theme/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted">
            Datos Consolidados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                <th className="px-8 py-4">Periodo</th>
                <th className="px-8 py-4">Ingresos</th>
                <th className="px-8 py-4">Egresos</th>
                <th className="px-8 py-4">Flujo Neto</th>
                <th className="px-8 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {[...points].reverse().map((point) => (
                <tr key={point.label} className="group text-sm transition-colors hover:bg-primary/5">
                  <td className="px-8 py-5 font-bold text-primary">{point.label}</td>
                  <td className="px-8 py-5 font-bold text-emerald-600">
                    +{formatCurrency(point.income)}
                  </td>
                  <td className="px-8 py-5 font-bold text-rose-600">
                    -{formatCurrency(point.expense)}
                  </td>
                  <td
                    className={`px-8 py-5 font-black ${
                      point.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {point.net >= 0 ? '+' : ''}
                    {formatCurrency(point.net)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        point.net >= 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {point.net >= 0 ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {point.net >= 0 ? 'Positivo' : 'Deficit'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
        <h2 className="text-xl font-bold text-primary">Contexto financiero</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Resumen de los componentes que impactan el flujo.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SummaryLine label="Ventas" value={formatCurrency(summary?.kpis.totalIncome || 0)} />
          <SummaryLine
            label="Compras"
            value={formatCurrency(summary?.kpis.totalPurchases || 0)}
            negative
          />
          <SummaryLine
            label="Gastos operativos"
            value={formatCurrency(summary?.kpis.totalOpex || 0)}
            negative
          />
          <SummaryLine
            label="COGS realizado"
            value={formatCurrencyOrUnavailable(summary?.kpis.totalCOGS ?? null)}
            negative
          />
        </div>
      </div>
    </div>
  );
}

function MetricBanner({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'rose';
  icon: React.ReactNode;
}) {
  const accents = {
    emerald: 'bg-emerald-50 text-emerald-500',
    rose: 'bg-rose-50 text-rose-500',
  };

  const text = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  };

  return (
    <div className="flex items-center justify-between rounded-3xl border border-theme bg-surface p-8 shadow-sm">
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted">
          {label}
        </p>
        <h3 className={`text-2xl font-black ${text[tone]}`}>{value}</h3>
      </div>
      <div className={`rounded-2xl p-3 ${accents[tone]}`}>{icon}</div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  const showNegativeSign = negative && value !== 'No disponible';

  return (
    <div className="flex items-center justify-between rounded-xl bg-base/40 px-4 py-3">
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className={`text-sm font-black ${showNegativeSign ? 'text-rose-600' : 'text-primary'}`}>
        {showNegativeSign ? '-' : ''}
        {value}
      </span>
    </div>
  );
}

