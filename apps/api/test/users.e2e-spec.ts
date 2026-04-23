import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  const usersService = {
    findAll: jest.fn(),
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    updateCustomerStatus: jest.fn(),
    deleteCustomer: jest.fn(),
    updateUserRole: jest.fn(),
  };

  const rolesService = {
    hasPermission: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rolesService.hasPermission.mockImplementation(
      (_userId: string, resource: string, action: string) =>
        resource === 'orders' && action === 'create',
    );

    const setup = await createTestApp({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('POST /api/v1/users/customers permite crear clientes a quien puede crear ordenes', async () => {
    usersService.createCustomer.mockResolvedValue({
      message: 'Cliente creado exitosamente',
      profile: { id: 'profile-1', email: 'customer@example.com' },
    });

    await request(getTestServer(app))
      .post('/api/v1/users/customers')
      .set('x-test-user-id', 'manager-1')
      .send({
        email: 'customer@example.com',
        password: 'secret123',
        firstName: 'Ana',
        lastName: 'Cliente',
      })
      .expect(201);

    expect(rolesService.hasPermission).toHaveBeenCalledWith(
      'manager-1',
      'orders',
      'create',
    );
    expect(usersService.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        firstName: 'Ana',
        lastName: 'Cliente',
      }),
      'manager-1',
    );
  });

  it('POST /api/v1/users/customers rechaza la solicitud sin usuario autenticado', async () => {
    await request(getTestServer(app))
      .post('/api/v1/users/customers')
      .send({
        email: 'customer@example.com',
        password: 'secret123',
        firstName: 'Ana',
        lastName: 'Cliente',
      })
      .expect(401);

    expect(usersService.createCustomer).not.toHaveBeenCalled();
  });

  it('POST /api/v1/users/customers rechaza a quien no puede crear ordenes ni usuarios', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await request(getTestServer(app))
      .post('/api/v1/users/customers')
      .set('x-test-user-id', 'customer-1')
      .send({
        email: 'customer@example.com',
        password: 'secret123',
        firstName: 'Ana',
        lastName: 'Cliente',
      })
      .expect(403);

    expect(usersService.createCustomer).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/users/customers/:id actualiza clientes a quien puede crear ordenes', async () => {
    usersService.updateCustomer.mockResolvedValue({
      message: 'Cliente actualizado exitosamente',
      profile: { id: 'profile-1', email: 'editado@example.com' },
    });

    await request(getTestServer(app))
      .patch('/api/v1/users/customers/user-1')
      .set('x-test-user-id', 'manager-1')
      .send({
        email: 'editado@example.com',
        firstName: 'Ana',
        lastName: 'Editada',
      })
      .expect(200);

    expect(usersService.updateCustomer).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        email: 'editado@example.com',
        firstName: 'Ana',
        lastName: 'Editada',
      }),
      'manager-1',
    );
  });

  it('PATCH /api/v1/users/customers/:id/status actualiza el estado del cliente', async () => {
    usersService.updateCustomerStatus.mockResolvedValue({
      message: 'Cliente desactivado exitosamente',
      profile: { id: 'profile-1' },
    });

    await request(getTestServer(app))
      .patch('/api/v1/users/customers/user-1/status')
      .set('x-test-user-id', 'manager-1')
      .send({
        isActive: false,
      })
      .expect(200);

    expect(usersService.updateCustomerStatus).toHaveBeenCalledWith(
      'user-1',
      false,
      'manager-1',
    );
  });

  it('DELETE /api/v1/users/customers/:id elimina el cliente cuando hay permiso', async () => {
    usersService.deleteCustomer.mockResolvedValue({
      message: 'Cliente eliminado exitosamente',
    });

    await request(getTestServer(app))
      .delete('/api/v1/users/customers/user-1')
      .set('x-test-user-id', 'manager-1')
      .expect(200);

    expect(usersService.deleteCustomer).toHaveBeenCalledWith(
      'user-1',
      'manager-1',
    );
  });
});
