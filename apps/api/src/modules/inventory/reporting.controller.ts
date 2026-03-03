import { Controller, Get, Query, Request } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('inventory/reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('closing')
  async getClosingReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any
  ) {
    const userId = req.user?.id || 'system-admin';
    return this.reportingService.getClosingReport(
      new Date(startDate),
      new Date(endDate),
      userId
    );
  }

  @Get('valuation')
  async getInventoryValuation() {
    return this.reportingService.getInventoryValuation();
  }
}
