import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../generated/client/enums';
import {
  applyProtectedAdminRole,
  isProtectedAdminEmail,
} from '../../common/utils/protected-admin.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => applyProtectedAdminRole(user));
  }

  async updateUserRole(userId: string, newRole: Role, actorUserId?: string) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    if (isProtectedAdminEmail(user.email) && newRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Esta cuenta siempre debe conservar el rol ADMIN',
      );
    }

    if (
      actorUserId === userId &&
      user.role === Role.ADMIN &&
      newRole !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No puedes quitarte a ti mismo el rol ADMIN',
      );
    }

    if (user.role === Role.ADMIN && newRole !== Role.ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new ForbiddenException(
          'No puedes cambiar el rol del ultimo ADMIN activo',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      return { message: 'Rol actualizado exitosamente', role: newRole };
    });
  }
}
