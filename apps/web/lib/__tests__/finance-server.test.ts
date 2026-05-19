import { 
  buildDefaultFixedExpensesConfig,
  ReportPreview,
  OrderProfitabilityReport,
  FixedExpensesConfig
} from '../finance-dashboard';
import {
  deriveSalesTaxReport,
  deriveRetentionsReport,
  deriveBreakEvenThermometer
} from '../finance-logic';

// We test logic independently since fetching is server-only and requires session
describe('finance dashboard logic', () => {
  const mockPreview: ReportPreview = {
    period: { label: 'May 2026', startDate: '2026-05-01', endDate: '2026-05-31' },
    orderCount: 10,
    returnedOrderCount: 1,
    totalItems: 50,
    returnItems: 2,
    grossSales: 1000000,
    returnsTotal: 50000,
    subtotal: 950000,
    estimatedTaxes: 180500,
    netBalance: 769500
  };

  const mockProfitability: OrderProfitabilityReport = {
    summary: {
      orderCount: 10,
      grossRevenue: 1000000,
      netSalesWithoutVat: 840336,
      vatLiability: 159664,
      productCost: 400000,
      commissionAmount: 30000,
      commissionVatAmount: 5700,
      logisticsCifAmount: 20000,
      grossProfit: 440336,
      operatingProfit: 410336,
      netProfit: 384636,
      realNetProfit: 400000,
      netReceivedBank: 950000,
      retentionAssetTotal: 15364,
      reteFuenteTotal: 10000,
      reteIvaTotal: 3000,
      reteIcaTotal: 2364,
      grossVsNetDelta: 50000,
      marginOnGatewayNet: 0.42,
      marginTarget: 0.6,
      belowTargetCount: 2
    },
    orders: []
  };

  it('derives sales tax report correctly', () => {
    const report = deriveSalesTaxReport(mockProfitability, mockPreview);
    expect(report).toBeDefined();
    expect(report?.taxTotal).toBe(159664);
    expect(report?.taxableBase).toBe(840336);
  });

  it('derives retentions report correctly', () => {
    const report = deriveRetentionsReport(mockProfitability);
    expect(report.summary.reteFuenteTotal).toBe(10000);
  });

  it('derives break-even thermometer correctly', () => {
    const config: FixedExpensesConfig = {
      ...buildDefaultFixedExpensesConfig(),
      monthlyTotal: 500000,
      isConfigured: true
    };
    const query = { startDate: '2026-05-01', endDate: '2026-05-31' };
    const report = deriveBreakEvenThermometer(query, config, mockProfitability);
    expect(report).toBeDefined();
    expect(report?.accumulatedNetProfit).toBe(400000);
  });
});
