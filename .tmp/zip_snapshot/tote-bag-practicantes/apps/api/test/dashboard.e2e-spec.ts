import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('DashboardController (e2e)', () => {
  let app: INestApplication;

  const dashboardService = {
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    dashboardService.getStats.mockResolvedValue({
      dailyProduction: 0,
      lowStockCount: 0,
      pendingQuotes: 0,
      newPqrsCount: 0,
      pendingPaymentOrders: 0,
      inProductionOrders: 0,
      pendingShipments: 0,
      pendingPersonalizationRequests: 0,
      inReviewPersonalizationRequests: 0,
      approvedPersonalizationRequests: 0,
      staleBatches: 0,
      supplierPendingBalance: 0,
      monthlyCashFlowNet: 0,
      topSellingProduct: null,
      lowestSellingProduct: null,
    });

    const setup = await createTestApp({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: dashboardService,
        },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/dashboard/stats usa threshold por defecto', async () => {
    await request(getTestServer(app))
      .get('/api/v1/dashboard/stats')
      .expect(200);

    expect(dashboardService.getStats).toHaveBeenCalledWith(10);
  });

  it('GET /api/v1/dashboard/stats hace fallback a 10 si query no es numerica', async () => {
    await request(getTestServer(app))
      .get('/api/v1/dashboard/stats?lowStockThreshold=abc')
      .expect(200);

    expect(dashboardService.getStats).toHaveBeenCalledWith(10);
  });
});
