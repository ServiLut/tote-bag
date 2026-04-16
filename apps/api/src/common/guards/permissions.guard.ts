import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesService } from '../../modules/roles/roles.service';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/require-permissions.decorator';
import { getPermissionsForRole } from '../utils/role-permissions.util';
import { getOperatorRoleForEmail } from '../utils/protected-admin.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; email?: string | null };
    }>();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    const operatorRole = getOperatorRoleForEmail(user.email);
    if (
      operatorRole &&
      this.hasRequiredPermissions(
        requiredPermissions,
        getPermissionsForRole(operatorRole),
      )
    ) {
      return true;
    }

    const userPermissions = await this.rolesService.getUserPermissions(user.id);

    const hasAllPermissions = this.hasRequiredPermissions(
      requiredPermissions,
      userPermissions,
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private hasRequiredPermissions(
    requiredPermissions: RequiredPermission[],
    userPermissions: Array<{ resource: string; action: string }>,
  ) {
    return requiredPermissions.every((required) =>
      userPermissions.some(
        (userPerm) =>
          userPerm.resource === required.resource &&
          userPerm.action === required.action,
      ),
    );
  }
}
