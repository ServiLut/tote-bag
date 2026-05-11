import { ProfilesService } from './profiles.service';
import { Role } from '../../generated/client/enums';
import { BadRequestException } from '@nestjs/common';

describe('ProfilesService', () => {
  const configService = {
    get: jest.fn(),
  };

  it('returns paginated profiles with search metadata', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'profile-1' }]);
    const count = jest.fn().mockResolvedValue(11);
    const transaction = jest
      .fn()
      .mockResolvedValue([[{ id: 'profile-1' }], 11]);

    const service = new ProfilesService(
      {
        profile: {
          findMany,
          count,
        },
        $transaction: transaction,
      } as never,
      {} as never,
      configService as never,
    );

    const result = await service.findAll({
      role: 'CUSTOMER',
      department: 'Antioquia',
      municipality: 'Medellin',
      search: 'ana',
      page: 2,
      pageSize: 10,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [{ id: 'profile-1', debugRoleAllowed: false }],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 11,
        totalPages: 2,
      },
    });
  });

  it('keeps legacy array response when pagination is not requested', async () => {
    const profiles = [{ id: 'profile-1' }, { id: 'profile-2' }];
    const findMany = jest.fn().mockResolvedValue(profiles);

    const service = new ProfilesService(
      {
        profile: {
          findMany,
          count: jest.fn(),
        },
        $transaction: jest.fn(),
      } as never,
      {} as never,
      configService as never,
    );

    await expect(
      service.findAll({
        role: 'CUSTOMER',
      }),
    ).resolves.toEqual([
      { id: 'profile-1', debugRoleAllowed: false },
      { id: 'profile-2', debugRoleAllowed: false },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('creates a missing profile from the authenticated user before resolving the role', async () => {
    const profileFindUnique = jest.fn().mockResolvedValue(null);
    const profileCreate = jest.fn().mockResolvedValue({
      id: 'profile-1',
      email: 'manager@example.com',
      userId: 'user-1',
      user: {
        role: Role.MANAGER,
      },
    });
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'manager@example.com',
    });
    const getDebugRole = jest.fn().mockReturnValue(null);

    const service = new ProfilesService(
      {
        profile: {
          findUnique: profileFindUnique,
          create: profileCreate,
        },
        user: {
          findUnique: userFindUnique,
        },
      } as never,
      { getDebugRole } as never,
      configService as never,
    );

    await expect(service.findByUserId('user-1')).resolves.toEqual({
      id: 'profile-1',
      email: 'manager@example.com',
      userId: 'user-1',
      user: {
        role: Role.MANAGER,
      },
      debugRoleAllowed: false,
    });
    expect(profileCreate).toHaveBeenCalledWith({
      data: {
        email: 'manager@example.com',
        userId: 'user-1',
      },
      include: { user: true },
    });
  });

  it('updates my profile usando nombres canonicos resueltos desde IDs', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'profile-1' });
    const departmentFindUnique = jest.fn().mockResolvedValue({
      id: 'dept-1',
      name: 'Antioquia',
    });
    const municipalityFindUnique = jest.fn().mockResolvedValue({
      id: 'mun-1',
      name: 'Medellin',
      departmentId: 'dept-1',
      department: {
        id: 'dept-1',
        name: 'Antioquia',
      },
    });

    const service = new ProfilesService(
      {
        profile: {
          update,
        },
        department: {
          findUnique: departmentFindUnique,
        },
        municipality: {
          findUnique: municipalityFindUnique,
        },
      } as never,
      {} as never,
      configService as never,
    );

    await service.update('user-1', {
      firstName: 'Ana',
      department: 'Otro nombre',
      municipality: 'Otro municipio',
      departmentId: 'dept-1',
      municipalityId: 'mun-1',
    });

    expect(update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        firstName: 'Ana',
        departmentId: 'dept-1',
        department: 'Antioquia',
        municipalityId: 'mun-1',
        municipality: 'Medellin',
      },
    });
  });

  it('rejects location names without canonical IDs in my profile updates', async () => {
    const service = new ProfilesService(
      {
        profile: {
          update: jest.fn(),
        },
        department: {
          findUnique: jest.fn(),
        },
        municipality: {
          findUnique: jest.fn(),
        },
      } as never,
      {} as never,
      configService as never,
    );

    await expect(
      service.update('user-1', {
        department: 'Antioquia',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects municipalities that do not belong to the selected department', async () => {
    const service = new ProfilesService(
      {
        profile: {
          update: jest.fn(),
        },
        department: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'dept-1',
            name: 'Antioquia',
          }),
        },
        municipality: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'mun-1',
            name: 'Bogota',
            departmentId: 'dept-2',
            department: {
              id: 'dept-2',
              name: 'Cundinamarca',
            },
          }),
        },
      } as never,
      {} as never,
      configService as never,
    );

    await expect(
      service.update('user-1', {
        departmentId: 'dept-1',
        municipalityId: 'mun-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
