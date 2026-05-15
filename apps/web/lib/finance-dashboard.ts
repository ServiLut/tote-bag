import { apiFetch } from '@/utils/api';

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

type ApiEnvelope<T> = { data?: T | null };

const EMPTY_RETENTIONS_REPORT: RetentionsReport = {
  summary: {
    orderCount: 0,
    reteFuenteTotal: 0,
    reteIvaTotal: 0,
    reteIcaTotal: 0,
    retentionAssetTotal: 0,
  },
  months: [],
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number) {
  return Number(value.toFixed(6));
}

function toNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeDate(value: string, endOfDay = false) {
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00';
  return new Date(`${value}${suffix}`);
}

function getInclusiveDayCount(startDate: Date, endDate: Date) {
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

function getMonthKey(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function resolvePeriodLabel(query: FinanceDashboardQuery) {
  if (query.month && query.year) {
    return new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(Number(query.year), Number(query.month) - 1, 1));
  }

  if (query.year && query.startDate === `${query.year}-01-01`) {
    return query.year;
  }

  if (query.startDate === query.endDate) {
    return new Intl.DateTimeFormat('es-CO').format(
      normalizeDate(query.startDate),
    );
  }

  return `${query.startDate} - ${query.endDate}`;
}

function calculateProratedFixedExpenseTarget(
  startDate: Date,
  endDate: Date,
  monthlyTotal: number,
) {
  if (!Number.isFinite(monthlyTotal) || monthlyTotal <= 0) {
    return 0;
  }

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  let target = 0;

  while (cursor <= endDate) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const overlapStart = startDate > monthStart ? startDate : monthStart;
    const overlapEnd = endDate < monthEnd ? endDate : monthEnd;

    if (overlapStart <= overlapEnd) {
      const coveredDays = getInclusiveDayCount(overlapStart, overlapEnd);
      target += (monthlyTotal * coveredDays) / monthEnd.getDate();
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return roundMoney(target);
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

export function buildTaxReportFromPreview(preview: ReportPreview): SalesTaxReport {
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

export function deriveSalesTaxReport(
  profitability: OrderProfitabilityReport | null,
  preview: ReportPreview | null,
) {
  if (!profitability) {
    return preview ? buildTaxReportFromPreview(preview) : null;
  }

  const taxableBase = toNumber(profitability.summary.netSalesWithoutVat);
  const taxTotal = toNumber(profitability.summary.vatLiability);
  const grossTotal = toNumber(profitability.summary.grossRevenue);
  const vatNetAfterReteIva = roundMoney(
    taxTotal - toNumber(profitability.summary.reteIvaTotal),
  );

  return {
    orderCount: profitability.summary.orderCount,
    taxableBase,
    taxTotal,
    grossTotal,
    vatLiabilityToReserve: taxTotal,
    reteIvaCredit: profitability.summary.reteIvaTotal,
    vatNetAfterReteIva,
    withholdingAssetTotal: profitability.summary.retentionAssetTotal,
    reconciliationDifference: roundMoney(
      grossTotal - (taxableBase + taxTotal),
    ),
    orders: profitability.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      status: order.status,
      createdAt: order.createdAt,
      totalAmount: order.ingresoBruto,
      netAmount: order.ventaNetaSinIva,
      taxTotal: order.iva,
      reteIvaAmount: order.reteIva,
      netReceivedAmount: order.netoRecibidoBanco,
    })),
  };
}

export function deriveRetentionsReport(
  profitability: OrderProfitabilityReport | null,
) {
  if (!profitability) {
    return EMPTY_RETENTIONS_REPORT;
  }

  const monthlyMap = profitability.orders.reduce<
    Record<
      string,
      {
        orderCount: number;
        reteFuente: number;
        reteIva: number;
        reteIca: number;
        total: number;
      }
    >
  >((accumulator, order) => {
    const month = getMonthKey(new Date(order.createdAt));

    if (!accumulator[month]) {
      accumulator[month] = {
        orderCount: 0,
        reteFuente: 0,
        reteIva: 0,
        reteIca: 0,
        total: 0,
      };
    }

    accumulator[month].orderCount += 1;
    accumulator[month].reteFuente += order.reteFuente;
    accumulator[month].reteIva += order.reteIva;
    accumulator[month].reteIca += order.reteIca;
    accumulator[month].total += order.retencionesActivas;

    return accumulator;
  }, {});

  return {
    summary: {
      orderCount: profitability.summary.orderCount,
      reteFuenteTotal: profitability.summary.reteFuenteTotal,
      reteIvaTotal: profitability.summary.reteIvaTotal,
      reteIcaTotal: profitability.summary.reteIcaTotal,
      retentionAssetTotal: profitability.summary.retentionAssetTotal,
    },
    months: Object.entries(monthlyMap)
      .map(([month, value]) => ({
        month,
        orderCount: value.orderCount,
        reteFuente: roundMoney(value.reteFuente),
        reteIva: roundMoney(value.reteIva),
        reteIca: roundMoney(value.reteIca),
        total: roundMoney(value.total),
      }))
      .sort((left, right) => left.month.localeCompare(right.month)),
  };
}

export function deriveBreakEvenThermometer(
  query: FinanceDashboardQuery,
  fixedExpensesConfig: FixedExpensesConfig,
  profitability: OrderProfitabilityReport | null,
): BreakEvenThermometerReport | null {
  if (!profitability) {
    return null;
  }

  const startDate = normalizeDate(query.startDate);
  const endDate = normalizeDate(query.endDate, true);
  const accumulatedNetProfit = roundMoney(
    toNumber(profitability.summary.realNetProfit),
  );
  const targetFixedExpenses = calculateProratedFixedExpenseTarget(
    startDate,
    endDate,
    fixedExpensesConfig.monthlyTotal,
  );
  const progressRatio =
    fixedExpensesConfig.isConfigured && targetFixedExpenses > 0
      ? accumulatedNetProfit / targetFixedExpenses
      : 0;
  const remainingToBreakEven =
    accumulatedNetProfit < targetFixedExpenses
      ? roundMoney(targetFixedExpenses - accumulatedNetProfit)
      : 0;
  const surplusOverBreakEven =
    accumulatedNetProfit > targetFixedExpenses
      ? roundMoney(accumulatedNetProfit - targetFixedExpenses)
      : 0;

  return {
    period: {
      label: resolvePeriodLabel(query),
      startDate: query.startDate,
      endDate: query.endDate,
    },
    fixedExpensesConfig,
    orderCount: profitability.summary.orderCount,
    accumulatedNetProfit,
    targetFixedExpenses,
    progressRatio: roundRatio(progressRatio),
    progressPercentage: roundMoney(progressRatio * 100),
    progressPercentageCapped: Math.max(0, Math.min(progressRatio * 100, 140)),
    remainingToBreakEven,
    surplusOverBreakEven,
    status:
      !fixedExpensesConfig.isConfigured || targetFixedExpenses <= 0
        ? 'UNCONFIGURED'
        : accumulatedNetProfit >= targetFixedExpenses
          ? 'BREAK_EVEN_REACHED'
          : 'IN_PROGRESS',
  };
}

async function fetchDashboardSection<T>(
  label: string,
  path: string,
  authHeaders: Record<string, string>,
  fetchImpl: typeof apiFetch,
) {
  try {
    const response = await fetchImpl(path, {
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: null as T | null,
        warning: `${label}: ${parseFinanceApiErrorMessage(
          errorText,
          'No fue posible cargar la seccion.',
        )} (${response.status})`,
      };
    }

    const result = await response.json();
    return {
      data: unwrapFinanceApiData<T>(result),
      warning: null,
    };
  } catch (error) {
    return {
      data: null as T | null,
      warning:
        error instanceof Error
          ? `${label}: ${error.message}`
          : `${label}: No fue posible cargar la seccion.`,
    };
  }
}

export async function loadFinanceDashboardData(params: {
  authHeaders: Record<string, string>;
  query: FinanceDashboardQuery;
  fetchImpl?: typeof apiFetch;
}): Promise<FinanceDashboardData> {
  const { authHeaders, query, fetchImpl = apiFetch } = params;
  const queryString = buildFinanceDashboardQueryParams(query).toString();

  const [
    summaryResult,
    previewResult,
    receivablesResult,
    profitabilityResult,
    fixedExpensesResult,
  ] = await Promise.all([
    fetchDashboardSection<FinancialSummary>(
      'Resumen financiero',
      `/inventory/finance/summary?${queryString}`,
      authHeaders,
      fetchImpl,
    ),
    fetchDashboardSection<ReportPreview>(
      'Reporte financiero',
      `/finance/report-preview?${queryString}`,
      authHeaders,
      fetchImpl,
    ),
    fetchDashboardSection<AccountsReceivableReport>(
      'Cuentas por cobrar',
      `/orders/accounts-receivable?${queryString}`,
      authHeaders,
      fetchImpl,
    ),
    fetchDashboardSection<OrderProfitabilityReport>(
      'Rentabilidad por pedido',
      `/finance/order-profitability?${queryString}`,
      authHeaders,
      fetchImpl,
    ),
    fetchDashboardSection<FixedExpensesConfig>(
      'Configuracion de gastos fijos',
      '/finance/fixed-expenses-config',
      authHeaders,
      fetchImpl,
    ),
  ]);

  const warnings = new Set<string>();
  for (const warning of [
    summaryResult.warning,
    previewResult.warning,
    receivablesResult.warning,
    profitabilityResult.warning,
    fixedExpensesResult.warning,
  ]) {
    if (warning) {
      warnings.add(warning);
    }
  }

  const preview = previewResult.data;
  const profitability = profitabilityResult.data;
  const fixedExpensesConfig =
    fixedExpensesResult.data ?? buildDefaultFixedExpensesConfig();
  const taxReport = deriveSalesTaxReport(profitability, preview);
  const retentionsReport = deriveRetentionsReport(profitability);
  const breakEvenThermometer = deriveBreakEvenThermometer(
    query,
    fixedExpensesConfig,
    profitability,
  );

  if (!profitability) {
    warnings.add(
      'Reporte de retenciones: no disponible mientras falla rentabilidad por pedido.',
    );
    warnings.add(
      'Termometro de punto de equilibrio: no disponible mientras falla rentabilidad por pedido.',
    );
  }

  return {
    summary: summaryResult.data,
    preview,
    receivables: normalizeAccountsReceivableReport(receivablesResult.data),
    taxReport,
    profitability,
    retentionsReport,
    fixedExpensesConfig,
    breakEvenThermometer,
    warnings: Array.from(warnings),
  };
}
