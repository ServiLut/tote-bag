import { APP_GUARD } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { Role } from '../src/generated/client/enums';
import { RolesService } from '../src/modules/roles/roles.service';
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
  const rolesService = {
    getUserPermissions: jest.fn(),
    getEffectiveRole: jest.fn(),
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
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.ADMIN,
    });
    rolesService.getUserPermissions.mockResolvedValue([
      { resource: 'dashboard', action: 'read' },
    ]);

    const setup = await createTestApp({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: dashboardService,
        },
        {
          provide: RolesService,
          useValue: rolesService,
        },
        {
          provide: APP_GUARD,
          useClass: PermissionsGuard,
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
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(dashboardService.getStats).toHaveBeenCalledWith(10, {
      includeAdminMetrics: true,
    });
  });

  it('GET /api/v1/dashboard/stats hace fallback a 10 si query no es numerica', async () => {
    await request(getTestServer(app))
      .get('/api/v1/dashboard/stats?lowStockThreshold=abc')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(dashboardService.getStats).toHaveBeenCalledWith(10, {
      includeAdminMetrics: true,
    });
  });

  it('GET /api/v1/dashboard/stats no incluye metricas admin para manager', async () => {
    rolesService.getEffectiveRole.mockResolvedValueOnce({
      effectiveRole: Role.MANAGER,
    });

    await request(getTestServer(app))
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'manager-1')
      .expect(200);

    expect(dashboardService.getStats).toHaveBeenCalledWith(10, {
      includeAdminMetrics: false,
    });
  });

  it('GET /api/v1/dashboard/stats responde 403 para customer sin permiso de dashboard', async () => {
    rolesService.getUserPermissions.mockResolvedValueOnce([]);

    await request(getTestServer(app))
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'customer-1')
      .expect(403);

    expect(dashboardService.getStats).not.toHaveBeenCalled();
  });
});
