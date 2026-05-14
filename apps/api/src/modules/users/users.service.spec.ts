import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/client/enums';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('reporta la cuenta protegida como ADMIN aunque la base de datos este desfasada', async () => {
    const service = new UsersService({
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'deybisasprilla@gmail.co',
            role: Role.CUSTOMER,
            isActive: true,
            createdAt: new Date('2026-04-15T00:00:00.000Z'),
            profile: null,
          },
        ]),
      },
    } as never);

    await expect(service.findAll()).resolves.toMatchObject([
      {
        email: 'deybisasprilla@gmail.co',
        role: Role.ADMIN,
      },
    ]);
  });

  it('no permite degradar la cuenta protegida desde gestion de usuarios', async () => {
    const service = new UsersService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'deybisasprilla@gmail.co',
          role: Role.ADMIN,
          isActive: true,
        }),
      },
    } as never);

    await expect(
      service.updateUserRole('user-1', Role.MANAGER, 'admin-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('consulta solo pedidos activos al validar la eliminacion de clientes', async () => {
    const profileFindUnique = jest.fn().mockResolvedValue({
      id: 'profile-1',
      user: {
        id: 'user-1',
        role: Role.CUSTOMER,
        isActive: true,
      },
      _count: {
        orders: 0,
        personalizationRequests: 0,
      },
    });

    const deleteUser = jest.fn().mockResolvedValue({ error: null });
    const userDelete = jest.fn().mockResolvedValue({});

    const service = new UsersService(
      {
        profile: {
          findUnique: profileFindUnique,
        },
        user: {
          delete: userDelete,
        },
      } as never,
      {
        get: jest.fn((key: string) => {
          if (key === 'SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_URL') {
            return 'https://example.supabase.co';
          }
          if (key === 'SERVICE_ROLE') {
            return 'service-role-key';
          }
          return undefined;
        }),
      } as never,
    );

    (
      service as unknown as {
        supabaseAdmin: { auth: { admin: { deleteUser: typeof deleteUser } } };
      }
    ).supabaseAdmin = {
      auth: {
        admin: {
          deleteUser,
        },
      },
    };

    await expect(
      service.deleteCustomer('user-1', 'admin-user'),
    ).resolves.toEqual({
      message: 'Cliente eliminado exitosamente',
    });

    expect(profileFindUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: {
        user: {
          select: { id: true, role: true, isActive: true },
        },
        _count: {
          select: {
            orders: {
              where: { deletedAt: null },
            },
            personalizationRequests: true,
          },
        },
      },
    });
  });

  it('bloquea eliminar clientes con pedidos activos', async () => {
    const service = new UsersService(
      {
        profile: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'profile-1',
            user: {
              id: 'user-1',
              role: Role.CUSTOMER,
              isActive: true,
            },
            _count: {
              orders: 1,
              personalizationRequests: 0,
            },
          }),
        },
      } as never,
      {
        get: jest.fn(),
      } as never,
    );

    await expect(
      service.deleteCustomer('user-1', 'admin-user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
