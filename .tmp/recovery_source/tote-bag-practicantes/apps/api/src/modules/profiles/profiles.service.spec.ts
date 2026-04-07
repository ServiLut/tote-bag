import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
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
      items: [{ id: 'profile-1' }],
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
    );

    await expect(
      service.findAll({
        role: 'CUSTOMER',
      }),
    ).resolves.toEqual(profiles);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
