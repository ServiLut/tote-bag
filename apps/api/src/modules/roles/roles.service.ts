import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getPermissionsForRole } from '../../common/utils/role-permissions.util';
import { DebugRoleContextService } from '../../common/context/debug-role-context.service';
import { Role } from '../../generated/client/enums';
import { getProtectedAdminRoleForEmail } from '../../common/utils/protected-admin.util';
import { redactEmail } from '../../common/logger/log-sanitization';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

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
    const protectedAdminRole = getProtectedAdminRoleForEmail(user?.email);

    return {
      user,
      effectiveRole: protectedAdminRole ?? debugRole ?? user?.role ?? null,
      debugRole,
    };
  }

  async getUserPermissions(userId: string) {
    const { user, effectiveRole, debugRole } =
      await this.getEffectiveRole(userId);
    this.logger.debug(
      `resolving permissions user=${userId} email=${redactEmail(user?.email)} storedRole=${user?.role ?? 'unknown'} effectiveRole=${effectiveRole ?? 'unknown'} debugRole=${debugRole ?? 'none'}`,
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
      return true;
    }

    const permissions = await this.getUserPermissions(userId);
    return permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }
}
