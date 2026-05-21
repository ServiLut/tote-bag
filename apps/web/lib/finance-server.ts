import 'server-only';
import { apiFetch } from '@/utils/api';
import { 
  FinancialSummary, 
  ReportPreview, 
  AccountsReceivableReport, 
  OrderProfitabilityReport, 
  FixedExpensesConfig,
  FinanceDashboardQuery,
  FinanceDashboardData,
  buildFinanceDashboardQueryParams,
  unwrapFinanceApiData,
  parseFinanceApiErrorMessage,
  normalizeAccountsReceivableReport,
  buildDefaultFixedExpensesConfig,
} from './finance-dashboard';
import {
  deriveSalesTaxReport,
  deriveRetentionsReport,
  deriveBreakEvenThermometer
} from './finance-logic';

/**
 * Server-only utility to fetch dashboard sections securely.
 */
async function fetchDashboardSectionServer<T>(
  label: string,
  path: string,
  authHeaders: Record<string, string>,
) {
  try {
    const response = await apiFetch(path, {
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

/**
 * Server-only function to load finance data.
 * This ensures that financial logic is computed and data is fetched only on the server.
 */
export async function loadFinanceDashboardDataServer(params: {
  authHeaders: Record<string, string>;
  query: FinanceDashboardQuery;
}): Promise<FinanceDashboardData> {
  const { authHeaders, query } = params;
  const queryString = buildFinanceDashboardQueryParams(query).toString();

  const [
    summaryResult,
    previewResult,
    receivablesResult,
    profitabilityResult,
    fixedExpensesResult,
  ] = await Promise.all([
    fetchDashboardSectionServer<FinancialSummary>(
      'Resumen financiero',
      `/inventory/finance/summary?${queryString}`,
      authHeaders,
    ),
    fetchDashboardSectionServer<ReportPreview>(
      'Reporte financiero',
      `/finance/report-preview?${queryString}`,
      authHeaders,
    ),
    fetchDashboardSectionServer<AccountsReceivableReport>(
      'Cuentas por cobrar',
      `/orders/accounts-receivable?${queryString}`,
      authHeaders,
    ),
    fetchDashboardSectionServer<OrderProfitabilityReport>(
      'Rentabilidad por pedido',
      `/finance/order-profitability?${queryString}`,
      authHeaders,
    ),
    fetchDashboardSectionServer<FixedExpensesConfig>(
      'Configuracion de gastos fijos',
      '/finance/fixed-expenses-config',
      authHeaders,
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
