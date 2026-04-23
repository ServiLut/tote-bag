import { Role } from '../../generated/client/enums';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('prioriza ADMIN protegido sobre rol QA y rol persistido', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'deybisasprilla@gmail.co',
          role: Role.CUSTOMER,
        }),
      },
    };
    const debugRoleContext = {
      getDebugRole: jest.fn().mockReturnValue(Role.MANAGER),
    };
    const service = new RolesService(
      prisma as never,
      debugRoleContext as never,
    );

    await expect(service.getEffectiveRole('user-1')).resolves.toMatchObject({
      effectiveRole: Role.ADMIN,
      debugRole: Role.MANAGER,
    });
  });

  it('ya no entrega permisos operativos de ordenes a customer', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'customer@example.com',
          role: Role.CUSTOMER,
        }),
      },
    };
    const debugRoleContext = {
      getDebugRole: jest.fn().mockReturnValue(null),
    };
    const service = new RolesService(
      prisma as never,
      debugRoleContext as never,
    );

    await expect(service.getUserPermissions('user-2')).resolves.toEqual([
      { resource: 'products', action: 'read' },
    ]);
  });
});
