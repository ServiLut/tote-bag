import { Controller, Get, Query, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RolesService } from '../roles/roles.service';
import { Role } from '../../generated/client/enums';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('stats')
  @RequirePermissions({ resource: 'orders', action: 'read' })
  async getStats(
    @Req() req: RequestWithUser,
    @Query('lowStockThreshold') lowStockThreshold?: string,
  ) {
    const threshold = lowStockThreshold ? Number(lowStockThreshold) : 10;
    const { effectiveRole } = req.user?.id
      ? await this.rolesService.getEffectiveRole(req.user.id)
      : { effectiveRole: null };

    return this.dashboardService.getStats(
      Number.isFinite(threshold) ? threshold : 10,
      {
        includeAdminMetrics: effectiveRole === Role.ADMIN,
      },
    );
  }
}
