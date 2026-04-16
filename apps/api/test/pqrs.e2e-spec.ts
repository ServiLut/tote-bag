import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PqrsController } from '../src/modules/pqrs/pqrs.controller';
import { PqrsService } from '../src/modules/pqrs/pqrs.service';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('PqrsController (e2e)', () => {
  let app: INestApplication;

  const pqrsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    countByStatus: jest.fn(),
    update: jest.fn(),
  };

  const rolesService = {
    hasPermission: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.hasPermission.mockResolvedValue(true);

    const setup = await createTestApp({
      controllers: [PqrsController],
      providers: [
        { provide: PqrsService, useValue: pqrsService },
        { provide: RolesService, useValue: rolesService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('POST /api/v1/pqrs crea tickets publicos desde ecommerce', async () => {
    pqrsService.create.mockResolvedValue({ id: 'pqrs-1', status: 'NUEVO' });

    await request(getTestServer(app))
      .post('/api/v1/pqrs')
      .send({
        fullName: 'Cliente Demo',
        email: 'cliente@demo.com',
        type: 'PETICION',
        subject: 'Estado del pedido',
        message: 'Necesito informacion sobre mi compra.',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'pqrs-1',
          status: 'NUEVO',
        });
      });

    expect(pqrsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Cliente Demo',
        email: 'cliente@demo.com',
        type: 'PETICION',
      }),
    );
  });

  it('GET /api/v1/pqrs requiere usuario autenticado en dashboard', async () => {
    await request(getTestServer(app)).get('/api/v1/pqrs').expect(401);
    expect(pqrsService.findAll).not.toHaveBeenCalled();
  });

  it('GET /api/v1/pqrs filtra por estado valido', async () => {
    pqrsService.findAll.mockResolvedValue([{ id: 'pqrs-2', status: 'NUEVO' }]);

    await request(getTestServer(app))
      .get('/api/v1/pqrs?status=NUEVO')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'admin-1',
      'orders',
      'read',
    );
    expect(pqrsService.findAll).toHaveBeenCalledWith('NUEVO');
  });

  it('GET /api/v1/pqrs/count devuelve conteo para el badge del dashboard', async () => {
    pqrsService.countByStatus.mockResolvedValue({ count: 2 });

    await request(getTestServer(app))
      .get('/api/v1/pqrs/count?status=NUEVO')
      .set('x-test-user-id', 'admin-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ count: 2 });
      });

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'admin-1',
      'orders',
      'read',
    );
    expect(pqrsService.countByStatus).toHaveBeenCalledWith('NUEVO');
  });

  it('GET /api/v1/pqrs permite acceso a operadores whitelisteados aunque el RBAC local aun no este sincronizado', async () => {
    rolesService.hasPermission.mockResolvedValue(false);
    pqrsService.findAll.mockResolvedValue([{ id: 'pqrs-4', status: 'NUEVO' }]);

    await request(getTestServer(app))
      .get('/api/v1/pqrs')
      .set('x-test-user-id', 'sync-pending-user')
      .set('x-test-user-email', 'deybisasprilla@gmail.com')
      .expect(200);

    expect(pqrsService.findAll).toHaveBeenCalledWith(undefined);
    expect(rolesService.hasPermission).not.toHaveBeenCalled();
  });

  it('GET /api/v1/pqrs/count evita RBAC para operadores whitelisteados', async () => {
    rolesService.hasPermission.mockRejectedValue(new Error('rbac unavailable'));
    pqrsService.countByStatus.mockResolvedValue({ count: 3 });

    await request(getTestServer(app))
      .get('/api/v1/pqrs/count?status=NUEVO')
      .set('x-test-user-id', 'sync-pending-user')
      .set('x-test-user-email', 'deybisasprilla@gmail.com')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ count: 3 });
      });

    expect(rolesService.hasPermission).not.toHaveBeenCalled();
    expect(pqrsService.countByStatus).toHaveBeenCalledWith('NUEVO');
  });

  it('GET /api/v1/pqrs rechaza estados invalidos para no romper la bandeja', async () => {
    await request(getTestServer(app))
      .get('/api/v1/pqrs?status=INVALIDO')
      .set('x-test-user-id', 'admin-1')
      .expect(400);

    expect(pqrsService.findAll).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/pqrs/:id actualiza estado y respuesta desde dashboard', async () => {
    pqrsService.update.mockResolvedValue({
      id: 'pqrs-3',
      status: 'RESPONDIDO',
      adminResponse: 'Caso atendido',
    });

    await request(getTestServer(app))
      .patch('/api/v1/pqrs/pqrs-3')
      .set('x-test-user-id', 'admin-2')
      .send({
        status: 'RESPONDIDO',
        adminResponse: 'Caso atendido',
      })
      .expect(200);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'admin-2',
      'orders',
      'update',
    );
    expect(pqrsService.update).toHaveBeenCalledWith('pqrs-3', {
      status: 'RESPONDIDO',
      adminResponse: 'Caso atendido',
    });
  });
});
