import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ShippingController } from '../src/modules/shipping/shipping.controller';
import { ShippingService } from '../src/modules/shipping/shipping.service';
import { ShippingPdfService } from '../src/modules/shipping/shipping.pdf.service';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('ShippingController (e2e)', () => {
  let app: INestApplication;

  const shippingService = {
    createProvider: jest.fn(),
    getProviders: jest.fn(),
    getProviderById: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
    getPendingShipments: jest.fn(),
    getShipments: jest.fn(),
    updateShipment: jest.fn(),
    processReturn: jest.fn(),
    getOrderAndShipment: jest.fn(),
  };

  const shippingPdfService = {
    generateShippingLabel: jest.fn(),
  };

  const rolesService = {
    hasPermission: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const setup = await createTestApp({
      controllers: [ShippingController],
      providers: [
        { provide: ShippingService, useValue: shippingService },
        { provide: ShippingPdfService, useValue: shippingPdfService },
        { provide: RolesService, useValue: rolesService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/shipping/providers responde 401 sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .get('/api/v1/shipping/providers')
      .expect(401);
  });

  it('GET /api/v1/shipping/providers responde 403 sin permisos', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .get('/api/v1/shipping/providers')
      .set('x-test-user-id', 'user-1')
      .expect(403);
  });

  it('GET /api/v1/shipping/providers permite acceso con permiso operativo', async () => {
    rolesService.hasPermission
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    shippingService.getProviders.mockResolvedValue([{ id: 'provider-1' }]);

    await request(getTestServer(app))
      .get('/api/v1/shipping/providers')
      .set('x-test-user-id', 'user-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'provider-1' }]);
      });
  });

  it('GET /api/v1/shipping/shipments responde 403 si solo tiene orders:create', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .get('/api/v1/shipping/shipments')
      .set('x-test-user-id', 'user-1')
      .expect(403);

    expect(shippingService.getShipments).not.toHaveBeenCalled();
  });

  it('GET /api/v1/shipping/permissions expone permisos de lectura y actualizacion', async () => {
    rolesService.hasPermission.mockImplementation(
      async (_userId: string, resource: string, action: string) =>
        resource === 'shipping' && action === 'read',
    );

    await request(getTestServer(app))
      .get('/api/v1/shipping/permissions')
      .set('x-test-user-id', 'user-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          shipments: {
            read: true,
            update: false,
          },
        });
      });
  });

  it('GET /api/v1/shipping/shipments/pending conserva headers de deprecacion', async () => {
    rolesService.hasPermission.mockResolvedValue(true);
    shippingService.getPendingShipments.mockResolvedValue([]);

    await request(getTestServer(app))
      .get('/api/v1/shipping/shipments/pending')
      .set('x-test-user-id', 'user-1')
      .expect(200)
      .expect('Deprecation', 'true')
      .expect('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT');
  });

  it('PATCH /api/v1/shipping/shipments/:orderId valida DTO de actualizacion', async () => {
    await request(getTestServer(app))
      .patch('/api/v1/shipping/shipments/order-1')
      .send({
        status: 'INVALID_STATUS',
      })
      .expect(400);

    expect(shippingService.updateShipment).not.toHaveBeenCalled();
  });
});
