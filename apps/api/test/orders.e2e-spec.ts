import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersService } from '../src/modules/orders/orders.service';
import { RolesService } from '../src/modules/roles/roles.service';
import { ReceiptPdfService } from '../src/modules/orders/orders.pdf.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;

  const ordersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    findOneWithDetails: jest.fn(),
  };

  const rolesService = {
    hasPermission: jest.fn(),
  };

  const receiptPdfService = {
    generateSaleReceipt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.hasPermission.mockResolvedValue(true);

    const setup = await createTestApp({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: RolesService, useValue: rolesService },
        { provide: ReceiptPdfService, useValue: receiptPdfService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('POST /api/v1/orders valida payload minimo y crea orden', async () => {
    ordersService.create.mockResolvedValue({ id: 'order-1', orderNumber: 101 });

    const response = await request(getTestServer(app))
      .post('/api/v1/orders')
      .send({
        firstName: 'Deybis',
        lastName: 'Asprilla',
        customerEmail: 'demo@tote.com',
        customerPhone: '3001234567',
        department: 'Antioquia',
        city: 'Medellin',
        shippingAddress: {
          city: 'Medellin',
          address: 'Calle 1 # 2-3',
          phone: '3001234567',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'variant-1',
            sku: 'SKU-1',
            quantity: 2,
            price: 999999,
          },
        ],
      })
      .expect(201);

    expect((response.body as { orderNumber: number }).orderNumber).toBe(101);

    expect(ordersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ECOMMERCE',
        initialStatus: 'PENDIENTE_PAGO',
        items: [
          expect.objectContaining({
            price: undefined,
          }),
        ],
      }),
      undefined,
      {
        idempotencyKey: undefined,
      },
    );
  });

  it('POST /api/v1/orders exige autenticacion para pedidos manuales', async () => {
    await request(getTestServer(app))
      .post('/api/v1/orders')
      .send({
        firstName: 'Deybis',
        lastName: 'Asprilla',
        customerEmail: 'demo@tote.com',
        customerPhone: '3001234567',
        department: 'Antioquia',
        city: 'Medellin',
        isManual: true,
        shippingAddress: {
          city: 'Medellin',
          address: 'Calle 1 # 2-3',
          phone: '3001234567',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'variant-1',
            sku: 'SKU-1',
            quantity: 1,
          },
        ],
      })
      .expect(401);

    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('POST /api/v1/orders exige permiso orders:create para pedidos manuales', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .post('/api/v1/orders')
      .set('x-test-user-id', 'user-1')
      .send({
        firstName: 'Deybis',
        lastName: 'Asprilla',
        customerEmail: 'demo@tote.com',
        customerPhone: '3001234567',
        department: 'Antioquia',
        city: 'Medellin',
        source: 'MANUAL',
        shippingAddress: {
          city: 'Medellin',
          address: 'Calle 1 # 2-3',
          phone: '3001234567',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'variant-1',
            sku: 'SKU-1',
            quantity: 1,
          },
        ],
      })
      .expect(403);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'user-1',
      'orders',
      'create',
    );
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('POST /api/v1/orders pasa el actor autenticado al servicio para pedidos manuales', async () => {
    ordersService.create.mockResolvedValue({ id: 'order-1', orderNumber: 102 });

    await request(getTestServer(app))
      .post('/api/v1/orders')
      .set('x-test-user-id', 'user-7')
      .send({
        firstName: 'Deybis',
        lastName: 'Asprilla',
        customerEmail: 'demo@tote.com',
        customerPhone: '3001234567',
        department: 'Antioquia',
        city: 'Medellin',
        isManual: true,
        shippingAddress: {
          city: 'Medellin',
          address: 'Calle 1 # 2-3',
          phone: '3001234567',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'variant-1',
            sku: 'SKU-1',
            quantity: 1,
            price: 12345,
          },
        ],
      })
      .expect(201);

    expect(ordersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            price: undefined,
          }),
        ],
      }),
      'user-7',
      {
        idempotencyKey: undefined,
      },
    );
  });

  it('POST /api/v1/orders reenvia el header de idempotencia al servicio', async () => {
    ordersService.create.mockResolvedValue({ id: 'order-1', orderNumber: 103 });

    await request(getTestServer(app))
      .post('/api/v1/orders')
      .set('x-idempotency-key', 'idem-order-1')
      .send({
        firstName: 'Deybis',
        lastName: 'Asprilla',
        customerEmail: 'demo@tote.com',
        customerPhone: '3001234567',
        department: 'Antioquia',
        city: 'Medellin',
        shippingAddress: {
          city: 'Medellin',
          address: 'Calle 1 # 2-3',
          phone: '3001234567',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'variant-1',
            sku: 'SKU-1',
            quantity: 2,
          },
        ],
      })
      .expect(201);

    expect(ordersService.create).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      {
        idempotencyKey: 'idem-order-1',
      },
    );
  });

  it('GET /api/v1/orders/user/:userId responde 401 sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .get('/api/v1/orders/user/user-1')
      .expect(401);

    expect(ordersService.findByUser).not.toHaveBeenCalled();
  });

  it('GET /api/v1/orders/user/:userId responde 403 si intenta ver otra cuenta sin permiso', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .get('/api/v1/orders/user/user-2')
      .set('x-test-user-id', 'user-1')
      .expect(403);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'user-1',
      'orders',
      'read',
    );
  });

  it('GET /api/v1/orders/user/:userId permite acceso al mismo usuario', async () => {
    ordersService.findByUser.mockResolvedValue([{ id: 'order-1' }]);

    await request(getTestServer(app))
      .get('/api/v1/orders/user/user-1')
      .set('x-test-user-id', 'user-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'order-1' }]);
      });

    expect(ordersService.findByUser).toHaveBeenCalledWith('user-1');
  });
});
