import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role } from '../../generated/client/client';
import { PayrollPdfService } from './payroll.pdf.service';
import { PayrollService } from './payroll.service';
import { ConsolidatePayrollStatementDto } from './dto/consolidate-payroll-statement.dto';
import { CreatePayrollShiftDto } from './dto/create-payroll-shift.dto';
import { CreatePayrollWorkerDto } from './dto/create-payroll-worker.dto';
import { UpdatePayrollStatementStatusDto } from './dto/update-payroll-statement-status.dto';
import { UpdatePayrollShiftDto } from './dto/update-payroll-shift.dto';
import { UpdatePayrollWorkerDto } from './dto/update-payroll-worker.dto';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly payrollPdfService: PayrollPdfService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureAdmin(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden gestionar nomina',
      );
    }
  }

  @Get('shifts')
  async getShifts(@Req() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.getShifts();
  }

  @Get('workers')
  async getWorkers(@Req() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.getWorkers();
  }

  @Get('workers/:id/history')
  async getWorkerHistory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.getWorkerHistory(id);
  }

  @Get('statements')
  async getStatements(@Req() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.getStatements();
  }

  @Get('statements/:id')
  async getStatementById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.getStatementById(id);
  }

  @Get('statements/:id/pdf')
  async downloadStatementPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.ensureAdmin(req.user?.id);
    const statement = await this.payrollService.getStatementWithShifts(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Cuenta_Cobro_Nomina_${statement.id}.pdf`,
    );

    return this.payrollPdfService.generateStatementPdf(res, statement);
  }

  @Post('shifts')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'entryPhoto', maxCount: 1 },
      { name: 'exitPhoto', maxCount: 1 },
    ]),
  )
  async createShift(
    @Body() dto: CreatePayrollShiftDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files: {
      entryPhoto?: Express.Multer.File[];
      exitPhoto?: Express.Multer.File[];
    },
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.createShift(dto, files, req.user!.id);
  }

  @Post('workers')
  async createWorker(
    @Body() dto: CreatePayrollWorkerDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.createWorker(dto, req.user!.id);
  }

  @Patch('shifts/:id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'entryPhoto', maxCount: 1 },
      { name: 'exitPhoto', maxCount: 1 },
    ]),
  )
  async updateShift(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollShiftDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files: {
      entryPhoto?: Express.Multer.File[];
      exitPhoto?: Express.Multer.File[];
    },
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.updateShift(id, dto, files, req.user!.id);
  }

  @Patch('workers/:id')
  async updateWorker(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollWorkerDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.updateWorker(id, dto, req.user!.id);
  }

  @Delete('workers/:id')
  async deleteWorker(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.deleteWorker(id);
  }

  @Delete('shifts/:id')
  async deleteShift(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.deleteShift(id);
  }

  @Post('statements/consolidate')
  async consolidateStatement(
    @Body() dto: ConsolidatePayrollStatementDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.consolidateStatement(dto, req.user!.id);
  }

  @Patch('statements/:id/status')
  async updateStatementStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollStatementStatusDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.payrollService.updateStatementStatus(id, dto, req.user!.id);
  }
}
