import { ProfilesService } from './profiles.service';
import { Role } from '../../generated/client/enums';

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
});
