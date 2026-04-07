import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '../../generated/client/client';
import { FinanceService } from './finance.service';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureAdmin(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden descargar reportes financieros',
      );
    }
  }

  @Get('report-preview')
  async getReportPreview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getFinancialReportPreview({
      startDate,
      endDate,
      month,
      year,
    });
  }

  @Get('export-report')
  async exportReport(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);

    const { fileName, buffer } =
      await this.financeService.generateFinancialReportPdf({
        startDate,
        endDate,
        month,
        year,
      });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': buffer.length,
    });

    res.status(200).send(buffer);
  }
}
