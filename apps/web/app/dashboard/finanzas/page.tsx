'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Download,
  Filter,
  Loader2,
  Plus,
  PieChart,
  Receipt,
  ShoppingBag,
  Target,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';
import { FINANCE_DATA_CHANGED_EVENT } from '@/lib/finance-events';

interface FinancialSummary {
  kpis: {
    totalIncome: number;
    totalOpex: number;
    totalPurchases: number;
    totalCOGS: number | null;
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

interface ReportPreview {
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  orderCount: number;
  returnedOrderCount: number;
  totalItems: number;
  returnItems: number;
  grossSales: number;
  returnsTotal: number;
  subtotal: number;
  estimatedTaxes: number;
  netBalance: number;
}

interface AccountsReceivableReport {
  summary: {
    orderCount: number;
    totalBalanceDue: number;
    totalAmountPaid: number;
  };
  orders: Array<{
    id: string;
    orderNumber: number;
    customerEmail: string;
    customerPhone?: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    status: string;
    createdAt: string;
  }>;
}

interface SalesTaxReport {
  orderCount: number;
  taxableBase: number;
  taxTotal: number;
  grossTotal: number;
  vatLiabilityToReserve: number;
  reteIvaCredit: number;
  vatNetAfterReteIva: number;
  withholdingAssetTotal: number;
  reconciliationDifference: number;
  orders: Array<{
    id: string;
    orderNumber: number;
    customerEmail: string;
    status: string;
    createdAt: string;
    totalAmount: number;
    netAmount: number;
    taxTotal: number;
    reteIvaAmount?: number;
    netReceivedAmount?: number;
  }>;
}

interface OrderProfitabilityReport {
  summary: {
    orderCount: number;
    grossRevenue: number;
    netSalesWithoutVat: number;
    vatLiability: number;
    productCost: number;
    commissionAmount: number;
    commissionVatAmount: number;
    logisticsCifAmount: number;
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    realNetProfit: number;
    netReceivedBank: number;
    retentionAssetTotal: number;
    reteFuenteTotal: number;
    reteIvaTotal: number;
    reteIcaTotal: number;
    grossVsNetDelta: number;
    marginOnGatewayNet: number | null;
    marginTarget: number;
    belowTargetCount: number;
  };
  orders: Array<{
    id: string;
    orderNumber: number;
    customerEmail: string;
    createdAt: string;
    status: string;
    paymentProvider: string;
    paymentMethodType: string;
    ingresoBruto: number;
    ventaNetaSinIva: number;
    iva: number;
    costoProducto: number;
    comisionWompi: number;
    ivaComision: number;
    costoLogisticoCif: number;
    utilidadBruta: number;
    utilidadOperativa: number;
    utilidadNeta: number;
    utilidadNetaReal: number;
    netoRecibidoBanco: number;
    retencionesActivas: number;
    reteFuente: number;
    reteIva: number;
    reteIca: number;
    brutoVsNetoDelta: number;
    margenSobreNetoPasarela: number | null;
    alertaMargenBajo: boolean;
    isFullyPaid: boolean;
  }>;
}

interface RetentionsReport {
  summary: {
    orderCount: number;
    reteFuenteTotal: number;
    reteIvaTotal: number;
    reteIcaTotal: number;
    retentionAssetTotal: number;
  };
  months: Array<{
    month: string;
    orderCount: number;
    reteFuente: number;
    reteIva: number;
    reteIca: number;
    total: number;
  }>;
}

interface FixedExpensesConfig {
  key: string;
  currency: 'COP';
  period: 'monthly';
  monthlyTotal: number;
  items: Array<{
    id: string;
    label: string;
    amount: number;
  }>;
  isConfigured: boolean;
  updatedAt: string | null;
}

interface BreakEvenThermometerReport {
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  fixedExpensesConfig: FixedExpensesConfig;
  orderCount: number;
  accumulatedNetProfit: number;
  targetFixedExpenses: number;
  progressRatio: number;
  progressPercentage: number;
  progressPercentageCapped: number;
  remainingToBreakEven: number;
  surplusOverBreakEven: number;
  status: 'UNCONFIGURED' | 'IN_PROGRESS' | 'BREAK_EVEN_REACHED';
}

type Granularity = 'day' | 'month' | 'year' | 'custom';
type ApiEnvelope<T> = { data?: T | null };

const supabase = createClient();

const EMPTY_ACCOUNTS_RECEIVABLE_REPORT: AccountsReceivableReport = {
  summary: {
    orderCount: 0,
    totalBalanceDue: 0,
    totalAmountPaid: 0,
  },
  orders: [],
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

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

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'No disponible';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function isValidDateInput(value: string) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function isStartDateAfterEndDate(startDate: string, endDate: string) {
  if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
    return false;
  }

  return (
    new Date(`${startDate}T00:00:00`).getTime() >
    new Date(`${endDate}T00:00:00`).getTime()
  );
}

function parseRequestErrorMessage(rawText: string, fallback: string) {
  if (!rawText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawText) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      return parsed.message.join(', ');
    }

    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }

    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    if (rawText.trim()) {
      return rawText;
    }
  }

  return fallback;
}

function buildTaxReportFromPreview(preview: ReportPreview): SalesTaxReport {
  return {
    orderCount: preview.orderCount,
    taxableBase: preview.subtotal,
    taxTotal: preview.estimatedTaxes,
    grossTotal: preview.grossSales,
    vatLiabilityToReserve: preview.estimatedTaxes,
    reteIvaCredit: 0,
    vatNetAfterReteIva: preview.estimatedTaxes,
    withholdingAssetTotal: 0,
    reconciliationDifference: 0,
    orders: [],
  };
}

function unwrapApiData<T>(result: T | ApiEnvelope<T> | null | undefined) {
  if (!result) {
    return null;
  }

  if (typeof result === 'object' && 'data' in result) {
    return (result as ApiEnvelope<T>).data ?? null;
  }

  return result as T;
}

function normalizeAccountsReceivableReport(
  report: AccountsReceivableReport | null,
): AccountsReceivableReport {
  return {
    summary: {
      orderCount: report?.summary?.orderCount ?? 0,
      totalBalanceDue: report?.summary?.totalBalanceDue ?? 0,
      totalAmountPaid: report?.summary?.totalAmountPaid ?? 0,
    },
    orders: Array.isArray(report?.orders) ? report.orders : [],
  };
}

function buildDefaultFixedExpenseInputs() {
  return [
    { id: 'payroll', label: 'Nomina', amount: '' },
    { id: 'rent', label: 'Arriendo', amount: '' },
    { id: 'services', label: 'Servicios', amount: '' },
  ];
}

export default function FinanceDashboardPage() {
  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [receivables, setReceivables] =
    useState<AccountsReceivableReport | null>(null);
  const [taxReport, setTaxReport] = useState<SalesTaxReport | null>(null);
  const [profitability, setProfitability] =
    useState<OrderProfitabilityReport | null>(null);
  const [retentionsReport, setRetentionsReport] =
    useState<RetentionsReport | null>(null);
  const [fixedExpensesConfig, setFixedExpensesConfig] =
    useState<FixedExpensesConfig | null>(null);
  const [breakEvenThermometer, setBreakEvenThermometer] =
    useState<BreakEvenThermometerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fixedExpenseInputs, setFixedExpenseInputs] = useState(
    buildDefaultFixedExpenseInputs(),
  );
  const [fixedExpensesSaving, setFixedExpensesSaving] = useState(false);
  const [fixedExpensesSaveError, setFixedExpensesSaveError] = useState<
    string | null
  >(null);
  const [fixedExpensesSaveSuccess, setFixedExpensesSaveSuccess] = useState<
    string | null
  >(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [selectedDate, setSelectedDate] = useState(
    toDateInputValue(currentDate),
  );
  const [selectedMonth, setSelectedMonth] = useState(
    `${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [customStartDate, setCustomStartDate] = useState(
    toDateInputValue(new Date(currentYear, currentDate.getMonth(), 1)),
  );
  const [customEndDate, setCustomEndDate] = useState(
    toDateInputValue(currentDate),
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    if (granularity === 'day') {
      params.set('startDate', selectedDate);
      params.set('endDate', selectedDate);
    } else if (granularity === 'month') {
      const [year, month] = selectedMonth.split('-');
      params.set('month', month);
      params.set('year', year);
      params.set('startDate', `${selectedMonth}-01`);
      const endOfMonth = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10),
        0,
      );
      params.set('endDate', toDateInputValue(endOfMonth));
    } else if (granularity === 'year') {
      params.set('year', selectedYear);
      params.set('startDate', `${selectedYear}-01-01`);
      params.set('endDate', `${selectedYear}-12-31`);
    } else {
      params.set('startDate', customStartDate);
      params.set('endDate', customEndDate);
    }

    return params;
  }, [
    customEndDate,
    customStartDate,
    granularity,
    selectedDate,
    selectedMonth,
    selectedYear,
  ]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        'Tu sesion expiro o no esta disponible. Inicia sesion nuevamente.',
      );
    }

    return { Authorization: `Bearer ${session.access_token}` };
  };

  useEffect(() => {
    let active = true;

    const fetchFinance = async () => {
      setLoading(true);
      setLoadError(null);
      setSummary(null);
      setPreview(null);
      setReceivables(null);
      setTaxReport(null);
      setProfitability(null);
      setRetentionsReport(null);
      setFixedExpensesConfig(null);
      setBreakEvenThermometer(null);

      if (
        granularity === 'custom' &&
        isStartDateAfterEndDate(customStartDate, customEndDate)
      ) {
        setLoadError('La fecha inicial no puede ser mayor que la fecha final.');
        setLoading(false);
        return;
      }

      try {
        const authHeaders = await getAuthHeaders();
        const [
          summaryRes,
          previewRes,
          receivablesRes,
          taxReportRes,
          profitabilityRes,
          retentionsRes,
          fixedExpensesRes,
          breakEvenThermometerRes,
        ] = await Promise.all([
          apiFetch(`/inventory/finance/summary?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch(`/finance/report-preview?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch(`/orders/accounts-receivable?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch(`/finance/tax-report?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch(`/finance/order-profitability?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch(`/finance/retentions-report?${queryParams.toString()}`, {
            headers: authHeaders,
          }),
          apiFetch('/finance/fixed-expenses-config', {
            headers: authHeaders,
          }),
          apiFetch(
            `/finance/break-even-thermometer?${queryParams.toString()}`,
            {
              headers: authHeaders,
            },
          ),
        ]);

        if (!active) return;

        if (
          !summaryRes.ok ||
          !previewRes.ok ||
          !receivablesRes.ok ||
          !taxReportRes.ok ||
          !profitabilityRes.ok ||
          !retentionsRes.ok ||
          !fixedExpensesRes.ok ||
          !breakEvenThermometerRes.ok
        ) {
          const firstError = [
            { label: 'Resumen financiero', response: summaryRes },
            { label: 'Reporte financiero', response: previewRes },
            { label: 'Cuentas por cobrar', response: receivablesRes },
            { label: 'Reporte IVA', response: taxReportRes },
            { label: 'Rentabilidad por pedido', response: profitabilityRes },
            { label: 'Reporte de retenciones', response: retentionsRes },
            {
              label: 'Configuracion de gastos fijos',
              response: fixedExpensesRes,
            },
            {
              label: 'Termometro de punto de equilibrio',
              response: breakEvenThermometerRes,
            },
          ].find(({ response }) => !response.ok)!;
          const firstErrorResponse = firstError.response;
          const errorText = await firstErrorResponse.text();
          const requestMessage = parseRequestErrorMessage(
            errorText,
            'No fue posible cargar el dashboard financiero.',
          );

          throw new Error(
            `${firstError.label}: ${requestMessage} (${firstErrorResponse.status})`,
          );
        }

        const [
          summaryResult,
          previewResult,
          receivablesResult,
          taxReportResult,
          profitabilityResult,
          retentionsResult,
          fixedExpensesResult,
          breakEvenThermometerResult,
        ] =
          await Promise.all([
            summaryRes.json(),
            previewRes.json(),
            receivablesRes.json(),
            taxReportRes.json(),
            profitabilityRes.json(),
            retentionsRes.json(),
            fixedExpensesRes.json(),
            breakEvenThermometerRes.json(),
          ]);
        const resolvedSummary = unwrapApiData<FinancialSummary>(summaryResult);
        const resolvedPreview = unwrapApiData<ReportPreview>(previewResult);
        const resolvedReceivables = normalizeAccountsReceivableReport(
          unwrapApiData<AccountsReceivableReport>(receivablesResult),
        );
        const resolvedTaxReport =
          unwrapApiData<SalesTaxReport>(taxReportResult);
        const resolvedProfitability =
          unwrapApiData<OrderProfitabilityReport>(profitabilityResult);
        const resolvedRetentions =
          unwrapApiData<RetentionsReport>(retentionsResult);
        const resolvedFixedExpenses =
          unwrapApiData<FixedExpensesConfig>(fixedExpensesResult);
        const resolvedBreakEvenThermometer =
          unwrapApiData<BreakEvenThermometerReport>(breakEvenThermometerResult);

        setSummary(resolvedSummary);
        setPreview(resolvedPreview);
        setReceivables(resolvedReceivables);
        setTaxReport(
          resolvedTaxReport ??
            (resolvedPreview ? buildTaxReportFromPreview(resolvedPreview) : null),
        );
        setProfitability(resolvedProfitability);
        setRetentionsReport(resolvedRetentions);
        setFixedExpensesConfig(resolvedFixedExpenses);
        setBreakEvenThermometer(resolvedBreakEvenThermometer);
        setFixedExpenseInputs(
          resolvedFixedExpenses?.items?.length
            ? resolvedFixedExpenses.items.map((item) => ({
                id: item.id,
                label: item.label,
                amount: item.amount > 0 ? String(item.amount) : '',
              }))
            : buildDefaultFixedExpenseInputs(),
        );
      } catch (error) {
        console.error('Error fetching financial dashboard:', error);
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar el dashboard financiero.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const handleFinanceDataChanged = () => {
      void fetchFinance();
    };

    void fetchFinance();
    window.addEventListener(FINANCE_DATA_CHANGED_EVENT, handleFinanceDataChanged);

    return () => {
      active = false;
      window.removeEventListener(
        FINANCE_DATA_CHANGED_EVENT,
        handleFinanceDataChanged,
      );
    };
  }, [customEndDate, customStartDate, granularity, queryParams]);

  const years = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => String(currentYear - index));
  }, [currentYear]);

  const profitabilitySummary = profitability?.summary ?? null;
  const netProfit =
    profitabilitySummary?.realNetProfit ??
    (summary
      ? summary.kpis.totalIncome -
        (summary.kpis.totalCOGS ?? 0) -
        summary.kpis.totalOpex
      : 0);

  const filteredTransactions =
    summary?.recentTransactions.filter(
      (tx) => filterCategory === 'ALL' || tx.category === filterCategory,
    ) || [];
  const receivablesSummary =
    receivables?.summary ?? EMPTY_ACCOUNTS_RECEIVABLE_REPORT.summary;
  const receivablesOrders = receivables?.orders ?? [];
  const profitabilityOrders = profitability?.orders ?? [];
  const retentionMonths = retentionsReport?.months ?? [];
  const thermometerProgressWidth = `${Math.max(
    0,
    Math.min(breakEvenThermometer?.progressPercentageCapped ?? 0, 140),
  )}%`;
  const thermometerStatusTone =
    breakEvenThermometer?.status === 'BREAK_EVEN_REACHED'
      ? 'emerald'
      : breakEvenThermometer?.status === 'UNCONFIGURED'
      ? 'slate'
      : 'amber';

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);

    if (
      granularity === 'custom' &&
      isStartDateAfterEndDate(customStartDate, customEndDate)
    ) {
      setExportError('La fecha inicial no puede ser mayor que la fecha final.');
      setExporting(false);
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await apiFetch(
        `/finance/export-report?${queryParams.toString()}`,
        {
          headers: authHeaders,
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          parseRequestErrorMessage(errorText, 'No fue posible generar el PDF'),
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_Financiero_${preview?.period?.label || 'periodo'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setExportError(
        error instanceof Error
          ? error.message
          : 'No fue posible generar el PDF',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleFixedExpenseChange = (
    id: string,
    field: 'label' | 'amount',
    value: string,
  ) => {
    setFixedExpensesSaveError(null);
    setFixedExpensesSaveSuccess(null);
    setFixedExpenseInputs((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === 'amount'
                  ? value.replace(/[^\d.,]/g, '').replace(',', '.')
                  : value,
            }
          : item,
      ),
    );
  };

  const handleAddFixedExpense = () => {
    setFixedExpensesSaveError(null);
    setFixedExpensesSaveSuccess(null);
    setFixedExpenseInputs((current) => [
      ...current,
      {
        id: `fixed-expense-${Date.now()}`,
        label: 'Nuevo gasto',
        amount: '',
      },
    ]);
  };

  const handleRemoveFixedExpense = (id: string) => {
    setFixedExpensesSaveError(null);
    setFixedExpensesSaveSuccess(null);
    setFixedExpenseInputs((current) =>
      current.length > 1 ? current.filter((item) => item.id !== id) : current,
    );
  };

  const handleSaveFixedExpenses = async () => {
    setFixedExpensesSaving(true);
    setFixedExpensesSaveError(null);
    setFixedExpensesSaveSuccess(null);

    const items = fixedExpenseInputs
      .map((item) => ({
        id: item.id,
        label: item.label.trim(),
        amount: item.amount.trim().length > 0 ? item.amount.trim() : '0',
      }))
      .filter((item) => item.label.length > 0);

    if (items.length === 0) {
      setFixedExpensesSaveError(
        'Debes registrar al menos un gasto fijo mensual.',
      );
      setFixedExpensesSaving(false);
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const configRes = await apiFetch('/finance/fixed-expenses-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ items }),
      });

      if (!configRes.ok) {
        const errorText = await configRes.text();
        throw new Error(
          parseRequestErrorMessage(
            errorText,
            'No fue posible guardar los gastos fijos.',
          ),
        );
      }

      const thermometerRes = await apiFetch(
        `/finance/break-even-thermometer?${queryParams.toString()}`,
        {
          headers: authHeaders,
        },
      );

      if (!thermometerRes.ok) {
        const errorText = await thermometerRes.text();
        throw new Error(
          parseRequestErrorMessage(
            errorText,
            'No fue posible recalcular el termometro de equilibrio.',
          ),
        );
      }

      const [configResult, thermometerResult] = await Promise.all([
        configRes.json(),
        thermometerRes.json(),
      ]);
      const resolvedConfig = unwrapApiData<FixedExpensesConfig>(configResult);
      const resolvedThermometer = unwrapApiData<BreakEvenThermometerReport>(
        thermometerResult,
      );

      setFixedExpensesConfig(resolvedConfig);
      setBreakEvenThermometer(resolvedThermometer);
      setFixedExpenseInputs(
        resolvedConfig?.items?.length
          ? resolvedConfig.items.map((item) => ({
              id: item.id,
              label: item.label,
              amount: item.amount > 0 ? String(item.amount) : '',
            }))
          : buildDefaultFixedExpenseInputs(),
      );
      setFixedExpensesSaveSuccess('Gastos fijos mensuales guardados.');
    } catch (error) {
      console.error('Error saving fixed expenses:', error);
      setFixedExpensesSaveError(
        error instanceof Error
          ? error.message
          : 'No fue posible guardar los gastos fijos.',
      );
    } finally {
      setFixedExpensesSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="flex animate-pulse flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-bold text-muted">
            Calculando estados financieros...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-7xl p-8 md:p-12">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-rose-700">
            Error de carga
          </p>
          <p className="mt-3 text-sm font-bold text-rose-800">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-in space-y-8 p-8 duration-500 fade-in slide-in-from-bottom-4 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-primary">
            <PieChart className="h-8 w-8 text-primary" />
            Dashboard Financiero
          </h1>
          <p className="font-medium text-muted">
            Analisis de rentabilidad, flujo de caja y exportacion de reportes
            PDF.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-theme bg-surface p-4 shadow-sm md:min-w-[420px]">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
            <Calendar className="h-4 w-4" />
            Filtros del reporte
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value as Granularity)
              }
              className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="day">Dia</option>
              <option value="month">Mes</option>
              <option value="year">Anio</option>
              <option value="custom">Rango personalizado</option>
            </select>

            {granularity === 'day' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : null}

            {granularity === 'month' ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : null}

            {granularity === 'year' ? (
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            ) : null}

            {granularity === 'custom' ? (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Generando PDF...' : 'Exportar Reporte'}
          </button>
          {exportError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {exportError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <PreviewCard
          label="Periodo exportable"
          value={preview?.period?.label || 'N/A'}
          tone="slate"
        />
        <PreviewCard
          label="Ordenes pagadas"
          value={String(preview?.orderCount || 0)}
          tone="emerald"
        />
        <PreviewCard
          label="Ventas brutas"
          value={formatCurrency(preview?.grossSales || 0)}
          tone="blue"
        />
        <PreviewCard
          label="Devoluciones"
          value={formatCurrency(preview?.returnsTotal || 0)}
          tone="rose"
        />
        <PreviewCard
          label="Balance final"
          value={formatCurrency(preview?.netBalance || 0)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ingresos Totales"
          value={formatCurrency(summary?.kpis.totalIncome || 0)}
          caption={`Incluye ${preview?.orderCount || 0} ordenes pagadas`}
          accent="emerald"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <MetricCard
          label="Costo de Venta (COGS)"
          value={formatCurrencyOrUnavailable(
            profitabilitySummary?.productCost ?? summary?.kpis.totalCOGS ?? null,
          )}
          caption={
            profitabilitySummary
              ? `Utilidad bruta: ${formatCurrency(profitabilitySummary.grossProfit)}`
              : summary?.kpis.totalCOGS === null
              ? 'Sin trazabilidad FIFO suficiente en el periodo'
              : `Items vendidos: ${preview?.totalItems || 0}`
          }
          accent="amber"
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <MetricCard
          label="IVA por Reservar"
          value={formatCurrency(taxReport?.vatLiabilityToReserve || 0)}
          caption={`ReteIVA activo: ${formatCurrency(taxReport?.reteIvaCredit || 0)}`}
          accent="blue"
          icon={<Receipt className="h-5 w-5" />}
        />
        <MetricCard
          label="Utilidad Neta Real"
          value={formatCurrency(netProfit)}
          caption={`Neto banco: ${formatCurrency(profitabilitySummary?.netReceivedBank || 0)}`}
          accent={netProfit >= 0 ? 'emerald' : 'rose'}
          icon={
            netProfit >= 0 ? (
              <ArrowUpRight className="h-5 w-5" />
            ) : (
              <ArrowDownRight className="h-5 w-5" />
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Utilidad Bruta"
          value={formatCurrency(profitabilitySummary?.grossProfit || 0)}
          caption={`Venta neta sin IVA: ${formatCurrency(profitabilitySummary?.netSalesWithoutVat || 0)}`}
          accent="emerald"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <MetricCard
          label="Utilidad Operativa"
          value={formatCurrency(profitabilitySummary?.operatingProfit || 0)}
          caption={`Comision + IVA comision: ${formatCurrency((profitabilitySummary?.commissionAmount || 0) + (profitabilitySummary?.commissionVatAmount || 0))}`}
          accent="amber"
          icon={<ArrowDownRight className="h-5 w-5" />}
        />
        <MetricCard
          label="Activo por Retenciones"
          value={formatCurrency(profitabilitySummary?.retentionAssetTotal || 0)}
          caption={`ReteFte ${formatCurrency(profitabilitySummary?.reteFuenteTotal || 0)} / ReteIVA ${formatCurrency(profitabilitySummary?.reteIvaTotal || 0)}`}
          accent="blue"
          icon={<Receipt className="h-5 w-5" />}
        />
        <MetricCard
          label="Margen sobre Neto Pasarela"
          value={formatPercentage(profitabilitySummary?.marginOnGatewayNet)}
          caption={`Alertas < 60%: ${profitabilitySummary?.belowTargetCount || 0}`}
          accent={
            (profitabilitySummary?.marginOnGatewayNet ?? 0) >=
            (profitabilitySummary?.marginTarget ?? 0.6)
              ? 'emerald'
              : 'rose'
          }
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm xl:col-span-2">
          <div className="border-b border-theme bg-base/30 p-6">
            <h2 className="text-xl font-bold text-primary">Cartera</h2>
            <p className="text-xs font-medium text-muted">
              Ordenes con saldo pendiente registradas por backend.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-b border-theme p-6 md:grid-cols-3">
            <PreviewCard
              label="Ordenes abiertas"
              value={String(receivablesSummary.orderCount)}
              tone="slate"
            />
            <PreviewCard
              label="Saldo pendiente"
              value={formatCurrency(receivablesSummary.totalBalanceDue)}
              tone="rose"
            />
            <PreviewCard
              label="Abonos recibidos"
              value={formatCurrency(receivablesSummary.totalAmountPaid)}
              tone="emerald"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Abonado</th>
                  <th className="px-6 py-4">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {receivablesOrders.slice(0, 6).map((order) => (
                  <tr
                    key={order.id}
                    className="text-sm transition-colors hover:bg-primary/5"
                  >
                    <td className="px-6 py-4 font-black text-primary">
                      #{order.orderNumber}
                    </td>
                    <td className="px-6 py-4 font-bold text-muted">
                      {order.customerEmail}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600">
                      {formatCurrency(order.amountPaid)}
                    </td>
                    <td className="px-6 py-4 font-black text-rose-600">
                      {formatCurrency(order.balanceDue)}
                    </td>
                  </tr>
                ))}
                {receivablesOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-sm font-bold text-muted"
                    >
                      No hay cartera pendiente.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-theme bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-bold text-primary">Reporte IVA</h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Pasivo de IVA por reservar y cruce informativo con reteIVA.
          </p>
          <div className="mt-6 space-y-3">
            <SummaryLine
              label="Base gravable"
              value={formatCurrency(taxReport?.taxableBase || 0)}
            />
            <SummaryLine
              label="IVA por reservar"
              value={formatCurrency(taxReport?.vatLiabilityToReserve || 0)}
            />
            <SummaryLine
              label="ReteIVA como activo"
              value={formatCurrency(taxReport?.reteIvaCredit || 0)}
            />
            <SummaryLine
              label="IVA neto tras reteIVA"
              value={formatCurrency(taxReport?.vatNetAfterReteIva || 0)}
              strong
            />
            <SummaryLine
              label="Retenciones activas"
              value={formatCurrency(taxReport?.withholdingAssetTotal || 0)}
            />
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-theme">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/30 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-4 py-3">Orden</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">ReteIVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {(taxReport?.orders || []).slice(0, 5).map((order) => (
                  <tr key={order.id} className="text-xs">
                    <td className="px-4 py-3 font-bold text-primary">
                      #{order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-primary">
                      {formatCurrency(order.taxTotal)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-blue-600">
                      {formatCurrency(order.reteIvaAmount || 0)}
                    </td>
                  </tr>
                ))}
                {!taxReport?.orders || taxReport.orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-xs font-bold text-muted"
                    >
                      Sin ordenes en el periodo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm xl:col-span-2">
          <div className="border-b border-theme bg-base/30 p-6">
            <h2 className="text-xl font-bold text-primary">
              Utilidad Neta Real por Pedido
            </h2>
            <p className="text-xs font-medium text-muted">
              Cruza venta neta, IVA, COGS FIFO, costos Wompi, retenciones y
              recaudo neto bancario.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-b border-theme p-6 md:grid-cols-4">
            <PreviewCard
              label="Bruto cobrado"
              value={formatCurrency(profitabilitySummary?.grossRevenue || 0)}
              tone="slate"
            />
            <PreviewCard
              label="Neto en banco"
              value={formatCurrency(profitabilitySummary?.netReceivedBank || 0)}
              tone="blue"
            />
            <PreviewCard
              label="Utilidad neta real"
              value={formatCurrency(profitabilitySummary?.realNetProfit || 0)}
              tone="emerald"
            />
            <PreviewCard
              label="Alertas < 60%"
              value={String(profitabilitySummary?.belowTargetCount || 0)}
              tone={
                (profitabilitySummary?.belowTargetCount || 0) > 0
                  ? 'rose'
                  : 'emerald'
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4 text-right">Bruto</th>
                  <th className="px-6 py-4 text-right">Neto banco</th>
                  <th className="px-6 py-4 text-right">Utilidad real</th>
                  <th className="px-6 py-4 text-right">Margen neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {profitabilityOrders.slice(0, 8).map((order) => (
                  <tr
                    key={order.id}
                    className="text-sm transition-colors hover:bg-primary/5"
                  >
                    <td className="px-6 py-4">
                      <p className="font-black text-primary">
                        #{order.orderNumber}
                      </p>
                      <p className="text-[11px] font-medium text-muted">
                        {order.customerEmail}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {formatCurrency(order.ingresoBruto)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      {formatCurrency(order.netoRecibidoBanco)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">
                      {formatCurrency(order.utilidadNetaReal)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                          order.alertaMargenBajo
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {formatPercentage(order.margenSobreNetoPasarela)}
                      </span>
                    </td>
                  </tr>
                ))}
                {profitabilityOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-sm font-bold text-muted"
                    >
                      Sin ordenes liquidadas para el periodo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-theme bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-bold text-primary">
            Retenciones como Activo
          </h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Anticipos tributarios retenidos por la pasarela y recuperables en
            conciliación fiscal.
          </p>
          <div className="mt-6 space-y-3">
            <SummaryLine
              label="ReteFuente"
              value={formatCurrency(retentionsReport?.summary.reteFuenteTotal || 0)}
            />
            <SummaryLine
              label="ReteIVA"
              value={formatCurrency(retentionsReport?.summary.reteIvaTotal || 0)}
            />
            <SummaryLine
              label="ReteICA"
              value={formatCurrency(retentionsReport?.summary.reteIcaTotal || 0)}
            />
            <SummaryLine
              label="Activo total"
              value={formatCurrency(retentionsReport?.summary.retentionAssetTotal || 0)}
              strong
            />
          </div>
          <div className="mt-6 space-y-3">
            {retentionMonths.slice(0, 4).map((month) => (
              <div
                key={month.month}
                className="rounded-2xl border border-theme bg-base/30 p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  {month.month}
                </p>
                <p className="mt-2 text-lg font-black text-primary">
                  {formatCurrency(month.total)}
                </p>
                <p className="text-[11px] font-medium text-muted">
                  {month.orderCount} ordenes con retencion.
                </p>
              </div>
            ))}
            {retentionMonths.length === 0 ? (
              <div className="rounded-2xl border border-theme bg-base/30 p-4 text-sm font-bold text-muted">
                Sin retenciones conciliadas en el periodo.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-xl font-bold text-primary">
                  Termometro de Punto de Equilibrio
                </h2>
                <p className="mt-1 text-xs font-medium text-muted">
                  El administrador configura gastos fijos mensuales y el backend
                  prorratea el objetivo del periodo filtrado.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddFixedExpense}
                  className="inline-flex items-center gap-2 rounded-xl border border-theme bg-base px-4 py-3 text-[11px] font-black uppercase tracking-wide text-primary transition-colors hover:bg-base/70"
                >
                  <Plus className="h-4 w-4" />
                  Agregar gasto
                </button>
                <button
                  type="button"
                  onClick={handleSaveFixedExpenses}
                  disabled={fixedExpensesSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[11px] font-black uppercase tracking-wide text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {fixedExpensesSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  {fixedExpensesSaving ? 'Guardando...' : 'Guardar gastos'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {fixedExpenseInputs.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-theme bg-base/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={item.label}
                      onChange={(event) =>
                        handleFixedExpenseChange(
                          item.id,
                          'label',
                          event.target.value,
                        )
                      }
                      className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-muted outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFixedExpense(item.id)}
                      disabled={fixedExpenseInputs.length <= 1}
                      className="rounded-lg border border-theme p-2 text-muted transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Eliminar ${item.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={item.amount}
                    inputMode="decimal"
                    onChange={(event) =>
                      handleFixedExpenseChange(
                        item.id,
                        'amount',
                        event.target.value,
                      )
                    }
                    placeholder="0"
                    className="mt-2 w-full bg-transparent text-2xl font-black text-primary outline-none"
                  />
                </div>
              ))}
            </div>

            {fixedExpensesSaveError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                {fixedExpensesSaveError}
              </p>
            ) : null}

            {fixedExpensesSaveSuccess ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                {fixedExpensesSaveSuccess}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-theme bg-base/20 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Periodo activo
            </p>
            <p className="mt-2 text-lg font-black text-primary">
              {breakEvenThermometer?.period.label || preview?.period?.label || 'N/A'}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {breakEvenThermometer?.orderCount || 0} ordenes liquidadas en el
              periodo.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PreviewCard
                label="Objetivo"
                value={formatCurrency(
                  breakEvenThermometer?.targetFixedExpenses || 0,
                )}
                tone="slate"
              />
              <PreviewCard
                label="Utilidad neta acumulada"
                value={formatCurrency(
                  breakEvenThermometer?.accumulatedNetProfit || 0,
                )}
                tone="emerald"
              />
              <PreviewCard
                label="Avance"
                value={`${(breakEvenThermometer?.progressPercentage || 0).toFixed(1)}%`}
                tone={thermometerStatusTone}
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted">
                <span>0%</span>
                <span>100%</span>
              </div>
              <div className="mt-2 h-5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    thermometerStatusTone === 'emerald'
                      ? 'bg-emerald-500'
                      : thermometerStatusTone === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                  style={{ width: thermometerProgressWidth }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <SummaryLine
                label="Objetivo mensual configurado"
                value={formatCurrency(fixedExpensesConfig?.monthlyTotal || 0)}
              />
              <SummaryLine
                label="Pendiente para equilibrio"
                value={formatCurrency(
                  breakEvenThermometer?.remainingToBreakEven || 0,
                )}
                strong={
                  (breakEvenThermometer?.remainingToBreakEven || 0) > 0
                }
              />
              <SummaryLine
                label="Excedente sobre objetivo"
                value={formatCurrency(
                  breakEvenThermometer?.surplusOverBreakEven || 0,
                )}
                strong={(breakEvenThermometer?.surplusOverBreakEven || 0) > 0}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-theme bg-surface px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                Estado
              </p>
              <p className="mt-2 text-sm font-black text-primary">
                {breakEvenThermometer?.status === 'BREAK_EVEN_REACHED'
                  ? 'Punto de equilibrio alcanzado'
                  : breakEvenThermometer?.status === 'UNCONFIGURED'
                  ? 'Configura gastos fijos para activar el termometro'
                  : 'En camino al punto de equilibrio'}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted">
                {fixedExpensesConfig?.updatedAt
                  ? `Ultima actualizacion: ${format(new Date(fixedExpensesConfig.updatedAt), "d 'de' MMMM yyyy, h:mm a", { locale: es })}`
                  : 'Aun no hay una configuracion mensual confirmada.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary">Flujo de Caja</h2>
              <p className="text-xs font-medium text-muted">
                Comparativa de entradas y salidas en el periodo filtrado.
              </p>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary?.cashFlowChart || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
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
                  tickFormatter={(value) => `$${value / 1000000}M`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number | undefined) => [
                    formatCurrency(value || 0),
                    '',
                  ]}
                />
                <Bar
                  dataKey="income"
                  name="Entradas"
                  fill="#000000"
                  radius={[6, 6, 0, 0]}
                  barSize={24}
                />
                <Bar
                  dataKey="expense"
                  name="Salidas"
                  fill="#00000033"
                  radius={[6, 6, 0, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-theme bg-surface p-8 shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-primary">
            Lo que llevara el PDF
          </h2>
          <p className="mb-8 text-xs font-medium text-muted">
            Vista previa del documento que descargara el super-admin.
          </p>

          <div className="flex-1 space-y-4">
            <SummaryLine
              label="Ventas brutas"
              value={formatCurrency(preview?.grossSales || 0)}
            />
            <SummaryLine
              label="Devoluciones"
              value={formatCurrency(preview?.returnsTotal || 0)}
              negative
            />
            <SummaryLine
              label="Subtotal"
              value={formatCurrency(preview?.subtotal || 0)}
            />
            <SummaryLine
              label="Impuestos"
              value={formatCurrency(preview?.estimatedTaxes || 0)}
            />
            <SummaryLine
              label="Balance final"
              value={formatCurrency(preview?.netBalance || 0)}
              strong
            />
          </div>

          <div className="mt-8 rounded-2xl border border-primary/10 bg-primary/5 p-6">
            <h4 className="mb-1 text-xs font-black uppercase tracking-widest text-primary">
              Cobertura del reporte
            </h4>
            <p className="text-2xl font-black text-primary">
              {preview?.orderCount || 0} ordenes
            </p>
            <p className="mt-1 text-[10px] font-medium text-muted">
              {preview?.returnedOrderCount || 0} devoluciones y{' '}
              {preview?.returnItems || 0} items retornados.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-theme bg-base/30 p-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-primary">
              Transacciones Recientes
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="rounded-xl border border-theme bg-base px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">Todas las Categorias</option>
              <option value="SALE">Ventas</option>
              <option value="PURCHASE">Compra de Material</option>
              <option value="OPEX">Gastos Oficina</option>
              <option value="PAYROLL">Nomina</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                <th className="px-8 py-4">Fecha</th>
                <th className="px-8 py-4">Descripcion</th>
                <th className="px-8 py-4">Categoria</th>
                <th className="px-8 py-4">Tipo</th>
                <th className="px-8 py-4">Monto</th>
                <th className="px-8 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="group text-sm transition-colors hover:bg-primary/5"
                >
                  <td className="px-8 py-5 font-medium text-muted">
                    {format(new Date(tx.createdAt), 'dd MMM, yyyy', {
                      locale: es,
                    })}
                  </td>
                  <td className="max-w-xs truncate px-8 py-5 font-bold text-primary">
                    {tx.description}
                  </td>
                  <td className="px-8 py-5">
                    <span className="rounded-md bg-theme/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted/70">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {tx.type === 'INCOME' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-rose-500" />
                      )}
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {tx.type === 'INCOME' ? 'Entrada' : 'Salida'}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-8 py-5 font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-primary'}`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      <CheckCircleIcon className="h-3 w-3" />
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

function MetricCard({
  label,
  value,
  caption,
  accent,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  accent: 'emerald' | 'amber' | 'blue' | 'rose';
  icon: React.ReactNode;
}) {
  const accents = {
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm transition-all hover:border-primary/30">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${accents[accent]}`}>{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <h3 className="mt-1 text-2xl font-black text-primary">{value}</h3>
      <p className="mt-2 text-[11px] font-medium text-muted">{caption}</p>
    </div>
  );
}

function PreviewCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'emerald' | 'blue' | 'rose' | 'amber';
}) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: string;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-base/40 px-4 py-3">
      <span
        className={`text-sm ${strong ? 'font-black text-primary' : 'font-bold text-muted'}`}
      >
        {label}
      </span>
      <span
        className={`text-sm font-black ${negative ? 'text-rose-600' : 'text-primary'}`}
      >
        {negative ? '-' : ''}
        {value}
      </span>
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
