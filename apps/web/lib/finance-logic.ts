import { 
  ReportPreview, 
  OrderProfitabilityReport, 
  SalesTaxReport,
  EMPTY_RETENTIONS_REPORT,
  FinanceDashboardQuery,
  FixedExpensesConfig,
  BreakEvenThermometerReport,
  roundMoney,
  roundRatio,
  toNumber,
  normalizeDate,
  getMonthKey,
  resolvePeriodLabel,
  getInclusiveDayCount
} from './finance-dashboard';

/**
 * Derives tax report from profitability or preview.
 */
export function deriveSalesTaxReport(
  profitability: OrderProfitabilityReport | null,
  preview: ReportPreview | null,
): SalesTaxReport | null {
  if (!profitability) {
    if (!preview) return null;
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

/**
 * Derives retentions report from profitability.
 */
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

export function calculateProratedFixedExpenseTarget(
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

/**
 * Derives break-even thermometer report.
 */
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
