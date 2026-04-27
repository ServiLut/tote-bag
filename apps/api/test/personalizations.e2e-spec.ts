import { APP_GUARD } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PersonalizationsController } from '../src/modules/personalizations/personalizations.controller';
import { PersonalizationsService } from '../src/modules/personalizations/personalizations.service';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('PersonalizationsController (e2e)', () => {
  let app: INestApplication;

  const personalizationsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createSignedUpload: jest.fn(),
    uploadDesign: jest.fn(),
    findRequests: jest.fn(),
    createRequest: jest.fn(),
    updateRequest: jest.fn(),
    approveRequest: jest.fn(),
  };

  const rolesService = {
    getUserPermissions: jest.fn(),
    hasPermission: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.getUserPermissions.mockResolvedValue([
      { resource: 'personalizations', action: 'manage' },
    ]);
    rolesService.hasPermission.mockResolvedValue(true);

    const setup = await createTestApp({
      controllers: [PersonalizationsController],
      providers: [
        { provide: PersonalizationsService, useValue: personalizationsService },
        { provide: RolesService, useValue: rolesService },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('bloquea CRUD administrativo sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .get('/api/v1/personalizations')
      .expect(403);
    await request(getTestServer(app))
      .post('/api/v1/personalizations')
      .send({ name: 'DTF', basePrice: 1000 })
      .expect(403);

    expect(personalizationsService.findAll).not.toHaveBeenCalled();
    expect(personalizationsService.create).not.toHaveBeenCalled();
  });

  it('permite CRUD administrativo con permiso personalizations:manage', async () => {
    personalizationsService.findAll.mockResolvedValue([{ id: 'opt-1' }]);

    await request(getTestServer(app))
      .get('/api/v1/personalizations')
      .set('x-test-user-id', 'admin-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'opt-1' }]);
      });

    expect(rolesService.getUserPermissions).toHaveBeenCalledWith('admin-1');
    expect(personalizationsService.findAll).toHaveBeenCalled();
  });

  it('bloquea signed-upload sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .post('/api/v1/personalizations/signed-upload')
      .send({
        fileName: 'logo.png',
        mimeType: 'image/png',
        size: 1024,
      })
      .expect(401);

    expect(personalizationsService.createSignedUpload).not.toHaveBeenCalled();
  });

  it('permite signed-upload con usuario autenticado', async () => {
    personalizationsService.createSignedUpload.mockResolvedValue({
      path: 'custom-designs/logo.png',
      token: 'signed-token',
      publicUrl: 'https://cdn.example.com/custom-designs/logo.png',
    });

    await request(getTestServer(app))
      .post('/api/v1/personalizations/signed-upload')
      .set('x-test-user-id', 'customer-1')
      .send({
        fileName: 'logo.png',
        mimeType: 'image/png',
        size: 1024,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          path: 'custom-designs/logo.png',
          token: 'signed-token',
          publicUrl: 'https://cdn.example.com/custom-designs/logo.png',
        });
      });

    expect(personalizationsService.createSignedUpload).toHaveBeenCalledWith({
      fileName: 'logo.png',
      mimeType: 'image/png',
      size: 1024,
    });
  });

  it('rechaza signed-upload con tamano vacio', async () => {
    await request(getTestServer(app))
      .post('/api/v1/personalizations/signed-upload')
      .set('x-test-user-id', 'customer-1')
      .send({
        fileName: 'logo.png',
        mimeType: 'image/png',
        size: 0,
      })
      .expect(400);

    expect(personalizationsService.createSignedUpload).not.toHaveBeenCalled();
  });

  it('bloquea upload-design sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .post('/api/v1/personalizations/upload-design')
      .attach('file', Buffer.from('fake-image'), 'logo.png')
      .expect(401);

    expect(personalizationsService.uploadDesign).not.toHaveBeenCalled();
  });

  it('rechaza upload-design con archivo vacio', async () => {
    await request(getTestServer(app))
      .post('/api/v1/personalizations/upload-design')
      .set('x-test-user-id', 'customer-1')
      .attach('file', Buffer.alloc(0), 'logo.png')
      .expect(400);

    expect(personalizationsService.uploadDesign).not.toHaveBeenCalled();
  });

  it('rechaza aprobacion con comprobante vacio', async () => {
    await request(getTestServer(app))
      .patch(
        '/api/v1/personalizations/requests/11111111-1111-4111-8111-111111111111/approve',
      )
      .set('x-test-user-id', 'admin-1')
      .attach('file', Buffer.alloc(0), 'comprobante.pdf')
      .expect(400);

    expect(personalizationsService.approveRequest).not.toHaveBeenCalled();
  });
});
