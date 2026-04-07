import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getPermissionsForRole } from '../../common/utils/role-permissions.util';
import { DebugRoleContextService } from '../../common/context/debug-role-context.service';
import { Role } from '../../generated/client/enums';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debugRoleContext: DebugRoleContextService,
  ) {}

  async getEffectiveRole(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    const debugRole = this.debugRoleContext.getDebugRole();

    return {
      user,
      effectiveRole: debugRole ?? user?.role ?? null,
      debugRole,
    };
  }

  async getUserPermissions(userId: string) {
    const { user, effectiveRole, debugRole } =
      await this.getEffectiveRole(userId);
    console.log(
      `RolesService: resolving permissions for user=${userId} email=${user?.email ?? 'unknown'} storedRole=${user?.role ?? 'unknown'} effectiveRole=${effectiveRole ?? 'unknown'} debugRole=${debugRole ?? 'none'}`,
    );

    return this.dedupePermissions(getPermissionsForRole(effectiveRole));
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

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const { effectiveRole } = await this.getEffectiveRole(userId);
    if (effectiveRole === Role.ADMIN) {
      if (resource === 'shipping') {
        console.log(
          `RolesService: shipping permission check user=${userId} action=${action} allowed=true permissions=*:*`,
        );
      }
      return true;
    }

    const permissions = await this.getUserPermissions(userId);
    const allowed = permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
    if (resource === 'shipping') {
      console.log(
        `RolesService: shipping permission check user=${userId} action=${action} allowed=${allowed} permissions=${permissions.map((p) => `${p.resource}:${p.action}`).join(',')}`,
      );
    }
    return allowed;
  }
}
