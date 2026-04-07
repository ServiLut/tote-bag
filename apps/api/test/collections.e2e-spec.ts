import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CollectionsController } from '../src/modules/collections/collections.controller';
import { CollectionsService } from '../src/modules/collections/collections.service';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('CollectionsController (e2e)', () => {
  let app: INestApplication;

  const collectionsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const rolesService = {
    hasPermission: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.hasPermission.mockResolvedValue(true);

    const setup = await createTestApp({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: collectionsService },
        { provide: RolesService, useValue: rolesService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/collections sigue siendo publico', async () => {
    collectionsService.findAll.mockResolvedValue([{ id: 'col-1' }]);

    await request(getTestServer(app))
      .get('/api/v1/collections')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'col-1' }]);
      });
  });

  it('POST /api/v1/collections responde 401 sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .post('/api/v1/collections')
      .send({ name: 'Corporativa', slug: 'corporativa' })
      .expect(401);

    expect(collectionsService.create).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/collections/:id responde 403 sin permiso products:update', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .patch('/api/v1/collections/550e8400-e29b-41d4-a716-446655440000')
      .set('x-test-user-id', 'user-1')
      .send({ name: 'Nueva' })
      .expect(403);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'user-1',
      'products',
      'update',
    );
  });

  it('DELETE /api/v1/collections/:id permite borrado con permiso products:delete', async () => {
    collectionsService.remove.mockResolvedValue({ id: 'col-1' });

    await request(getTestServer(app))
      .delete('/api/v1/collections/550e8400-e29b-41d4-a716-446655440000')
      .set('x-test-user-id', 'user-9')
      .expect(200);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'user-9',
      'products',
      'delete',
    );
    expect(collectionsService.remove).toHaveBeenCalled();
  });
});
