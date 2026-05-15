import {
  buildDefaultFixedExpensesConfig,
  loadFinanceDashboardData,
} from '../finance-dashboard';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ data: body }), {
      status,
      headers: {
        'content-type': 'application/json',
      },
    }),
  );
}

describe('finance dashboard helpers', () => {
  const authHeaders = { Authorization: 'Bearer token' };
  const query = {
    month: '03',
    year: '2026',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  };

  it('loads five base sections and derives secondary finance reports locally', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          kpis: {
            totalIncome: 119000,
            totalOpex: 15000,
            totalPurchases: 40000,
            totalCOGS: 40000,
          },
          cashFlowChart: [],
          recentTransactions: [],
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          period: {
            label: 'marzo de 2026',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
          },
          orderCount: 1,
          returnedOrderCount: 0,
          totalItems: 2,
          returnItems: 0,
          grossSales: 119000,
          returnsTotal: 0,
          subtotal: 100000,
          estimatedTaxes: 19000,
          netBalance: 119000,
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          summary: {
            orderCount: 1,
            totalBalanceDue: 0,
            totalAmountPaid: 119000,
          },
          orders: [],
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          summary: {
            orderCount: 1,
            grossRevenue: 119000,
            netSalesWithoutVat: 100000,
            vatLiability: 19000,
            productCost: 40000,
            commissionAmount: 3000,
            commissionVatAmount: 570,
            logisticsCifAmount: 990,
            grossProfit: 60000,
            operatingProfit: 55440,
            netProfit: 55440,
            realNetProfit: 4000000,
            netReceivedBank: 111440,
            retentionAssetTotal: 1700,
            reteFuenteTotal: 900,
            reteIvaTotal: 600,
            reteIcaTotal: 200,
            grossVsNetDelta: 7560,
            marginOnGatewayNet: 0.49,
            marginTarget: 0.6,
            belowTargetCount: 1,
          },
          orders: [
            {
              id: 'order-1',
              orderNumber: 101,
              customerEmail: 'cliente@tote.co',
              createdAt: '2026-03-10T10:00:00.000Z',
              status: 'ENTREGADA',
              paymentProvider: 'wompi',
              paymentMethodType: 'CARD',
              ingresoBruto: 119000,
              ventaNetaSinIva: 100000,
              iva: 19000,
              costoProducto: 40000,
              comisionWompi: 3000,
              ivaComision: 570,
              costoLogisticoCif: 990,
              utilidadBruta: 60000,
              utilidadOperativa: 55440,
              utilidadNeta: 55440,
              utilidadNetaReal: 4000000,
              netoRecibidoBanco: 111440,
              retencionesActivas: 1700,
              reteFuente: 900,
              reteIva: 600,
              reteIca: 200,
              brutoVsNetoDelta: 7560,
              margenSobreNetoPasarela: 0.49,
              alertaMargenBajo: true,
              isFullyPaid: true,
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          key: 'finance.monthly_fixed_expenses',
          currency: 'COP',
          period: 'monthly',
          monthlyTotal: 8000000,
          items: [
            { id: 'payroll', label: 'Nomina', amount: 5000000 },
            { id: 'rent', label: 'Arriendo', amount: 3000000 },
          ],
          isConfigured: true,
          updatedAt: '2026-03-01T10:00:00.000Z',
        }),
      );

    const result = await loadFinanceDashboardData({
      authHeaders,
      query,
      fetchImpl: fetchMock as never,
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/inventory/finance/summary?startDate=2026-03-01&endDate=2026-03-31&month=03&year=2026',
      '/finance/report-preview?startDate=2026-03-01&endDate=2026-03-31&month=03&year=2026',
      '/orders/accounts-receivable?startDate=2026-03-01&endDate=2026-03-31&month=03&year=2026',
      '/finance/order-profitability?startDate=2026-03-01&endDate=2026-03-31&month=03&year=2026',
      '/finance/fixed-expenses-config',
    ]);
    expect(result.taxReport).toMatchObject({
      orderCount: 1,
      taxableBase: 100000,
      taxTotal: 19000,
      reteIvaCredit: 600,
      withholdingAssetTotal: 1700,
    });
    expect(result.retentionsReport.months).toEqual([
      {
        month: '2026-03',
        orderCount: 1,
        reteFuente: 900,
        reteIva: 600,
        reteIca: 200,
        total: 1700,
      },
    ]);
    expect(result.breakEvenThermometer).toMatchObject({
      targetFixedExpenses: 8000000,
      accumulatedNetProfit: 4000000,
      progressPercentage: 50,
      status: 'IN_PROGRESS',
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps partial data and warnings when profitability fails', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          kpis: {
            totalIncome: 119000,
            totalOpex: 15000,
            totalPurchases: 40000,
            totalCOGS: 40000,
          },
          cashFlowChart: [],
          recentTransactions: [],
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          period: {
            label: 'marzo de 2026',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
          },
          orderCount: 1,
          returnedOrderCount: 0,
          totalItems: 2,
          returnItems: 0,
          grossSales: 119000,
          returnsTotal: 0,
          subtotal: 100000,
          estimatedTaxes: 19000,
          netBalance: 119000,
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          summary: {
            orderCount: 0,
            totalBalanceDue: 0,
            totalAmountPaid: 0,
          },
          orders: [],
        }),
      )
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockImplementationOnce(() => jsonResponse(buildDefaultFixedExpensesConfig()));

    const result = await loadFinanceDashboardData({
      authHeaders,
      query,
      fetchImpl: fetchMock as never,
    });

    expect(result.taxReport).toMatchObject({
      orderCount: 1,
      taxableBase: 100000,
      taxTotal: 19000,
    });
    expect(result.retentionsReport).toEqual({
      summary: {
        orderCount: 0,
        reteFuenteTotal: 0,
        reteIvaTotal: 0,
        reteIcaTotal: 0,
        retentionAssetTotal: 0,
      },
      months: [],
    });
    expect(result.breakEvenThermometer).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Rentabilidad por pedido: bad gateway (502)',
        'Reporte de retenciones: no disponible mientras falla rentabilidad por pedido.',
        'Termometro de punto de equilibrio: no disponible mientras falla rentabilidad por pedido.',
      ]),
    );
  });
});
