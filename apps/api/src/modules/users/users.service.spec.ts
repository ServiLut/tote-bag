import { ForbiddenException } from '@nestjs/common';
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
});
