import { Controller, Get, Query, Request, Res } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { Response } from 'express';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('inventory/reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('closing')
  async getClosingReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id';
    return this.reportingService.getClosingReport(
      new Date(startDate),
      new Date(endDate),
      userId,
    );
  }

  @Get('valuation')
  async getInventoryValuation() {
    return this.reportingService.getInventoryValuation();
  }

  @Get('accounting')
  async getAccountingReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportingService.getAccountingReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('accounting/export/excel')
  async exportAccountingExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportingService.generateAccountingExcel(
      new Date(startDate),
      new Date(endDate),
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Reporte_Contable_${startDate}_${endDate}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }

  @Get('accounting/export/pdf')
  async exportAccountingPDF(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportingService.generateAccountingPDF(
      new Date(startDate),
      new Date(endDate),
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Reporte_Contable_${startDate}_${endDate}.pdf`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }
}
