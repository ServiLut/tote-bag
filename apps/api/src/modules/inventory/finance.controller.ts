import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '../../generated/client/client';
import { FinanceService } from './finance.service';
import { RolesService } from '../roles/roles.service';
import { BreakEvenSimulationDto } from './dto/break-even-simulation.dto';
import { GatewayMarginGridDto } from './dto/gateway-margin-grid.dto';
import { UpdateFixedExpensesConfigDto } from './dto/update-fixed-expenses-config.dto';

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

  @Get('tax-report')
  async getTaxReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getSalesTaxReport({ startDate, endDate });
  }

  @Get('order-profitability')
  async getOrderProfitability(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getOrderProfitabilityReport({
      startDate,
      endDate,
    });
  }

  @Get('retentions-report')
  async getRetentionsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getRetentionReport({ startDate, endDate });
  }

  @Get('fixed-expenses-config')
  async getFixedExpensesConfig(@Req() req?: RequestWithUser) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getFixedExpensesConfig();
  }

  @Put('fixed-expenses-config')
  async updateFixedExpensesConfig(
    @Body() body: UpdateFixedExpensesConfigDto,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.updateFixedExpensesConfig(body);
  }

  @Get('break-even-thermometer')
  async getBreakEvenThermometer(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getBreakEvenThermometer({
      startDate,
      endDate,
      month,
      year,
    });
  }

  @Post('gateway-margin-grid')
  async getGatewayMarginGrid(
    @Body() body: GatewayMarginGridDto,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getGatewayMarginGrid(body);
  }

  @Post('break-even-simulation')
  async simulateBreakEven(
    @Body() body: BreakEvenSimulationDto,
    @Req() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.simulateBreakEven(body);
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
