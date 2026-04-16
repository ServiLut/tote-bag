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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.getUserPermissions.mockResolvedValue([
      { resource: 'personalizations', action: 'manage' },
    ]);

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
});
