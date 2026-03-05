import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(userId: string) {
    const [user, userRoles] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      this.prisma.userRole.findMany({
        where: { userId },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Flatten permissions
    const directPermissions = userRoles.flatMap((ur) =>
      ur.role.permissions.map((rp) => ({
        resource: rp.permission.resource,
        action: rp.permission.action,
      })),
    );

    // Backward-compatible fallback:
    // if user_roles are not populated, infer permissions from legacy user.role.
    if (directPermissions.length === 0 && user?.role) {
      const inferred = await this.getLegacyRolePermissions(user.role);
      return this.dedupePermissions(inferred);
    }

    return this.dedupePermissions(directPermissions);
  }

  private dedupePermissions(
    permissions: Array<{ resource: string; action: string }>,
  ) {
    // Remove duplicates
    return Array.from(
      new Set(permissions.map((p) => `${p.resource}:${p.action}`)),
    ).map((p) => {
      const [resource, action] = p.split(':');
      return { resource, action };
    });
  }

  private async getLegacyRolePermissions(role: string) {
    if (role === 'ADMIN') {
      return this.prisma.permission.findMany({
        select: { resource: true, action: true },
      });
    }

    // Map legacy enum role to seeded RBAC role names.
    const mappedRoleName =
      role === 'ADVISOR' ? 'manager' : role === 'CUSTOMER' ? 'customer' : null;

    if (mappedRoleName) {
      const mappedRole = await this.prisma.roleModel.findUnique({
        where: { name: mappedRoleName },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (mappedRole) {
        return mappedRole.permissions.map((rp) => ({
          resource: rp.permission.resource,
          action: rp.permission.action,
        }));
      }
    }

    // VIEWER (or unknown) fallback: read-only dashboard access.
    return [
      { resource: 'products', action: 'read' },
      { resource: 'orders', action: 'read' },
    ];
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }
}
