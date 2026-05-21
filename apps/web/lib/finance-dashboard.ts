import { 
  getBogotaMonthKey, 
  formatBogotaDate,
  parseBogotaDate
} from './bogota-date';

export interface FinancialSummary {
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

export interface ReportPreview {
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

export interface AccountsReceivableReport {
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

export interface SalesTaxReport {
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

export interface OrderProfitabilityReport {
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

export interface RetentionsReport {
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

export interface FixedExpensesConfig {
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

export interface BreakEvenThermometerReport {
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

export interface FinanceDashboardQuery {
  startDate: string;
  endDate: string;
  month?: string;
  year?: string;
}

export interface FinanceDashboardData {
  summary: FinancialSummary | null;
  preview: ReportPreview | null;
  receivables: AccountsReceivableReport;
  taxReport: SalesTaxReport | null;
  profitability: OrderProfitabilityReport | null;
  retentionsReport: RetentionsReport;
  fixedExpensesConfig: FixedExpensesConfig;
  breakEvenThermometer: BreakEvenThermometerReport | null;
  warnings: string[];
}

export type ApiEnvelope<T> = { data?: T | null };

export const EMPTY_RETENTIONS_REPORT: RetentionsReport = {
  summary: {
    orderCount: 0,
    reteFuenteTotal: 0,
    reteIvaTotal: 0,
    reteIcaTotal: 0,
    retentionAssetTotal: 0,
  },
  months: [],
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundRatio(value: number) {
  return Number(value.toFixed(6));
}

export function toNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function normalizeDate(value: string, endOfDay = false) {
  return parseBogotaDate(value, { endOfDay });
}

export function getInclusiveDayCount(startDate: Date, endDate: Date) {
  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function getMonthKey(date: Date) {
  return getBogotaMonthKey(date);
}

export function resolvePeriodLabel(query: FinanceDashboardQuery) {
  if (query.month && query.year) {
    return new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    }).format(new Date(Number(query.year), Number(query.month) - 1, 1));
  }

  if (query.year && query.startDate === `${query.year}-01-01`) {
    return query.year;
  }

  if (query.startDate === query.endDate) {
    const d = new Date(`${query.startDate}T12:00:00`);
    return formatBogotaDate(d);
  }

  return `${query.startDate} - ${query.endDate}`;
}

export function buildFinanceDashboardQueryParams(query: FinanceDashboardQuery) {
  const params = new URLSearchParams();
  params.set('startDate', query.startDate);
  params.set('endDate', query.endDate);

  if (query.month) {
    params.set('month', query.month);
  }

  if (query.year) {
    params.set('year', query.year);
  }

  return params;
}

export function unwrapFinanceApiData<T>(
  result: T | ApiEnvelope<T> | null | undefined,
) {
  if (!result) {
    return null;
  }

  if (typeof result === 'object' && 'data' in result) {
    return (result as ApiEnvelope<T>).data ?? null;
  }

  return result as T;
}

export function parseFinanceApiErrorMessage(rawText: string, fallback: string) {
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

export function buildDefaultFixedExpensesConfig(): FixedExpensesConfig {
  return {
    key: 'finance.monthly_fixed_expenses',
    currency: 'COP',
    period: 'monthly',
    monthlyTotal: 0,
    items: [
      { id: 'payroll', label: 'Nomina', amount: 0 },
      { id: 'rent', label: 'Arriendo', amount: 0 },
      { id: 'services', label: 'Servicios', amount: 0 },
    ],
    isConfigured: false,
    updatedAt: null,
  };
}

export function normalizeAccountsReceivableReport(
  report: AccountsReceivableReport | null,
) {
  return {
    summary: {
      orderCount: report?.summary?.orderCount ?? 0,
      totalBalanceDue: report?.summary?.totalBalanceDue ?? 0,
      totalAmountPaid: report?.summary?.totalAmountPaid ?? 0,
    },
    orders: Array.isArray(report?.orders) ? report.orders : [],
  };
}
