import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions({ resource: 'orders', action: 'read' })
  getStats(@Query('lowStockThreshold') lowStockThreshold?: string) {
    const threshold = lowStockThreshold ? Number(lowStockThreshold) : 10;
    return this.dashboardService.getStats(
      Number.isFinite(threshold) ? threshold : 10,
    );
  }
}
