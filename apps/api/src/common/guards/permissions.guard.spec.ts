import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

function createExecutionContext(user?: { id: string; email?: string | null }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('permite a operadores whitelisteados usando permisos locales si RBAC no esta disponible', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([{ resource: 'orders', action: 'read' }]),
    } as unknown as Reflector;
    const rolesService = {
      getUserPermissions: jest
        .fn()
        .mockRejectedValue(new Error('rbac unavailable')),
    };
    const guard = new PermissionsGuard(reflector, rolesService as never);

    await expect(
      guard.canActivate(
        createExecutionContext({
          id: 'user-1',
          email: 'deybisasprilla@gmail.com',
        }),
      ),
    ).resolves.toBe(true);
    expect(rolesService.getUserPermissions).not.toHaveBeenCalled();
  });

  it('ya no concede fallback operativo a admin@tote-bag.com', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([{ resource: 'orders', action: 'read' }]),
    } as unknown as Reflector;
    const rolesService = {
      getUserPermissions: jest.fn().mockResolvedValue([]),
    };
    const guard = new PermissionsGuard(reflector, rolesService as never);

    await expect(
      guard.canActivate(
        createExecutionContext({
          id: 'user-legacy-admin',
          email: 'admin@tote-bag.com',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rolesService.getUserPermissions).toHaveBeenCalledWith(
      'user-legacy-admin',
    );
  });

  it('sigue rechazando usuarios sin permisos requeridos', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([{ resource: 'users', action: 'delete' }]),
    } as unknown as Reflector;
    const rolesService = {
      getUserPermissions: jest.fn().mockResolvedValue([]),
    };
    const guard = new PermissionsGuard(reflector, rolesService as never);

    await expect(
      guard.canActivate(
        createExecutionContext({
          id: 'user-2',
          email: 'customer@example.com',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rolesService.getUserPermissions).toHaveBeenCalledWith('user-2');
  });

  it('permite endpoints sin permisos declarados', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === PERMISSIONS_KEY ? undefined : [],
      ),
    } as unknown as Reflector;
    const rolesService = {
      getUserPermissions: jest.fn(),
    };
    const guard = new PermissionsGuard(reflector, rolesService as never);

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(
      true,
    );
  });
});
