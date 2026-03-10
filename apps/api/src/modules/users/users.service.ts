import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../generated/client/enums';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
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
  }

  async updateUserRole(userId: string, newRole: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Actualizar el campo 'role' en el modelo User
      await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      // 2. Sincronizar la tabla 'UserRole'
      // Mapeo de Role enum a nombres de RoleModel (según seed)
      const roleMapping: Record<string, string> = {
        [Role.ADMIN]: 'admin',
        [Role.MANAGER]: 'manager',
        [Role.CUSTOMER]: 'customer',
        [Role.ADVISOR]: 'manager',
        [Role.VIEWER]: 'viewer', // Podría no existir en el seed pero es buena práctica
      };

      const roleName = roleMapping[newRole] || newRole.toLowerCase();

      // Buscar el RoleModel correspondiente
      const roleModel = await tx.roleModel.findFirst({
        where: {
          name: {
            equals: roleName,
            mode: 'insensitive',
          },
        },
      });

      if (roleModel) {
        // Eliminar roles anteriores
        await tx.userRole.deleteMany({
          where: { userId },
        });

        // Asignar el nuevo rol
        await tx.userRole.create({
          data: {
            userId,
            roleId: roleModel.id,
          },
        });
      }

      return { message: 'Rol actualizado exitosamente', role: newRole };
    });
  }
}
