import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

describe('ProfilesController', () => {
  const profilesService = {
    findAll: jest.fn(),
    update: jest.fn(),
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

  it('allows order creators to list customer profiles for manual orders', async () => {
    rolesService.hasPermission.mockImplementation(
      (_userId: string, resource: string, action: string) =>
        Promise.resolve(resource === 'orders' && action === 'create'),
    );
    profilesService.findAll.mockResolvedValue([]);

    await controller.findAll(
      { user: { id: 'manager-1' } } as never,
      'CUSTOMER',
      undefined,
      undefined,
      undefined,
      0,
      0,
    );

    expect(profilesService.findAll).toHaveBeenCalledWith({
      role: 'CUSTOMER',
      department: undefined,
      municipality: undefined,
      search: undefined,
      page: undefined,
      pageSize: undefined,
    });
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

  it('forwards validated profile updates for the authenticated user', async () => {
    const payload = {
      firstName: 'Ana',
      departmentId: 'dept-1',
      municipalityId: 'mun-1',
    };
    profilesService.update = jest.fn().mockResolvedValue({ ok: true });

    await controller.updateMe({ user: { id: 'user-1' } } as never, payload);

    expect(profilesService.update).toHaveBeenCalledWith('user-1', payload);
  });

  it('rejects fields fuera del DTO de perfil', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          firstName: 'Ana',
          user: {
            update: {
              role: 'ADMIN',
            },
          },
        },
        {
          type: 'body',
          metatype: UpdateMyProfileDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
