import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';

describe('ProfilesController', () => {
  const profilesService = {
    findAll: jest.fn(),
  };
  const rolesService = {
    hasPermission: jest.fn(),
  };

  let controller: ProfilesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProfilesController(
      profilesService as never,
      rolesService as never,
    );
  });

  it('requires users:read to list profiles', async () => {
    rolesService.hasPermission.mockResolvedValue(false);

    await expect(
      controller.findAll(
        { user: { id: 'customer-1' } } as never,
        'CUSTOMER',
        undefined,
        undefined,
        undefined,
        0,
        0,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(profilesService.findAll).not.toHaveBeenCalled();
  });

  it('forwards paginated filters when the actor can read users', async () => {
    rolesService.hasPermission.mockResolvedValue(true);
    profilesService.findAll.mockResolvedValue({ items: [], pagination: {} });

    await controller.findAll(
      { user: { id: 'admin-1' } } as never,
      'CUSTOMER',
      'Antioquia',
      'Medellin',
      'ana',
      2,
      25,
    );

    expect(profilesService.findAll).toHaveBeenCalledWith({
      role: 'CUSTOMER',
      department: 'Antioquia',
      municipality: 'Medellin',
      search: 'ana',
      page: 2,
      pageSize: 25,
    });
  });

  it('rejects unauthenticated requests', async () => {
    await expect(
      controller.findAll(
        {} as never,
        undefined,
        undefined,
        undefined,
        undefined,
        0,
        0,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
