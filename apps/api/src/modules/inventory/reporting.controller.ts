import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
  Request,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { Response } from 'express';
import { Role } from '../../generated/client/client';
import { RolesService } from '../roles/roles.service';
import { format } from 'date-fns';

interface RequestWithUser {
  user?: { id: string };
}

function parseDateQuery(value: string, endOfDay = false) {
  if (!value) {
    throw new BadRequestException('La fecha es obligatoria');
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Rango de fechas invalido');
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

@Controller('inventory/reporting')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureAdmin(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden acceder a reportes contables',
      );
    }
  }

  @Get('closing')
  async getClosingReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.reportingService.getClosingReport(
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
      req.user!.id,
    );
  }

  @Get('valuation')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async getInventoryValuation(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.reportingService.getInventoryValuation();
  }

  @Get('accounting')
  async getAccountingReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.reportingService.getAccountingReport(
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
    );
  }

  @Get('accounting/export/excel')
  async exportAccountingExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer = await this.reportingService.generateAccountingExcel(
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
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
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer = await this.reportingService.generateAccountingPDF(
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Reporte_Contable_${startDate}_${endDate}.pdf`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }

  @Get('fifo/export/excel')
  async exportFifoInventoryExcel(
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer = await this.reportingService.generateFifoInventoryExcel();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Reporte_Inventario_FIFO_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }

  @Get('fifo/export/pdf')
  async exportFifoInventoryPDF(
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer = await this.reportingService.generateFifoInventoryPDF();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Reporte_Inventario_FIFO_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }

  @Get('non-commercial-outputs/export/excel')
  async exportNonCommercialOutputsExcel(
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer =
      await this.reportingService.generateNonCommercialOutputsExcel();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Reporte_Salidas_No_Comerciales_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }

  @Get('non-commercial-outputs/export/pdf')
  async exportNonCommercialOutputsPDF(
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const buffer =
      await this.reportingService.generateNonCommercialOutputsPDF();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Reporte_Salidas_No_Comerciales_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }
}
