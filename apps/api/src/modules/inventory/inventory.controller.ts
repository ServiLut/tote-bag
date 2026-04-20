import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Patch,
  Delete,
  Body,
  Request,
  Query,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../generated/client/client';
import { InventoryService } from './inventory.service';
import { FinanceService } from './finance.service';
import {
  CreatePurchaseBatchDto,
  CreateSupplyItemDto,
} from './dto/create-purchase-batch.dto';
import { UpdatePurchaseBatchDto } from './dto/update-purchase-batch.dto';
import { BreakEvenSimulationDto } from './dto/break-even-simulation.dto';
import {
  CreateOpexDto,
  CreateOpexCategoryDto,
  CreateSupplierPaymentDto,
  UpdateSupplierDto,
} from './dto/finance-inputs.dto';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser {
  user?: { id: string };
}

function parseDateQuery(value?: string, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
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
        'Solo los usuarios ADMIN pueden gestionar inventario y finanzas',
      );
    }
  }

  private async ensureAdminOrManager(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN && effectiveRole !== Role.MANAGER) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN o GERENTE pueden aprobar cambios criticos de inventario',
      );
    }
  }

  @Get('detailed')
  async getDetailedInventory(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.getDetailedInventory();
  }

  @Get('movements')
  async getInventoryMovements(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.getInventoryMovements();
  }

  @Get('products/:productId/average-cost')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async getAverageCost(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    const averageCost = await this.inventoryService.getAverageCost(productId);

    return {
      productId,
      averageCost,
    };
  }

  @Post('batch')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async createBatch(
    @Body()
    body: {
      productId: string;
      variantId: string;
      supplierId: string;
      quantityReceived: number;
      unitCost: number;
      purchaseDate: string;
    },
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.createBatch({
      ...body,
      purchaseDate: new Date(body.purchaseDate),
      userId: req.user!.id,
    });
  }

  @Post('receive-batch')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async receiveBatch(
    @Body() data: CreatePurchaseBatchDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.receiveBatch({
      ...data,
      userId: req.user!.id,
    });
  }

  @Post('batches')
  async createPurchaseBatch(
    @Body() data: CreatePurchaseBatchDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.createPurchaseBatch({
      ...data,
      userId: req.user!.id,
    });
  }

  @Get('batches')
  async findAllBatches(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.findAllBatches();
  }

  @Get('receivable-variants')
  async findReceivableVariants(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.findReceivableVariants();
  }

  @Get('supply-items')
  async findAllSupplyItems(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.findAllSupplyItems();
  }

  @Post('supply-items')
  async createSupplyItem(
    @Body() body: CreateSupplyItemDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.createSupplyItem(body);
  }

  @Patch('batches/:id')
  async updatePurchaseBatch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdatePurchaseBatchDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdminOrManager(req.user?.id);
    return this.inventoryService.updatePurchaseBatch(id, {
      ...data,
      userId: req.user!.id,
    });
  }

  @Delete('batches/:id')
  async deletePurchaseBatch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.inventoryService.deletePurchaseBatch(id, req.user!.id);
  }

  @Get('suppliers')
  async findAllSuppliers(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.findAllSuppliers();
  }

  @Post('suppliers')
  async createSupplier(
    @Body()
    body: {
      name: string;
      nit: string;
      contact?: string;
      phone?: string;
      email?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.createSupplier(body);
  }

  @Patch('suppliers/:id')
  async updateSupplier(
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.updateSupplier(id, body);
  }

  @Get('suppliers/:id')
  async getSupplierDetails(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.getSupplierDetails(id);
  }

  @Post('suppliers/:id/payments')
  async createSupplierPayment(
    @Param('id') id: string,
    @Body() body: CreateSupplierPaymentDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.createSupplierPayment({
      ...body,
      supplierId: id,
      userId: req.user!.id,
    });
  }

  @Get('finance/summary')
  async getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getFinancialSummaryLocalized(
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
    );
  }

  @Get('finance/cash-flow')
  async getCashFlowData(
    @Query('period') period?: 'daily' | 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getCashFlowData(
      period,
      parseDateQuery(startDate),
      parseDateQuery(endDate, true),
    );
  }

  @Get('finance/tax-report')
  async getSalesTaxReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.getSalesTaxReport({ startDate, endDate });
  }

  @Post('finance/break-even-simulation')
  async simulateBreakEven(
    @Body() body: BreakEvenSimulationDto,
    @Request() req?: RequestWithUser,
  ) {
    await this.ensureAdmin(req?.user?.id);
    return this.financeService.simulateBreakEven(body);
  }

  @Get('finance/opex-categories')
  async getOpexCategories(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.getOpexCategoriesSafe();
  }

  @Post('finance/opex-categories')
  async createOpexCategory(
    @Body() body: CreateOpexCategoryDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.createOpexCategory(body.name);
  }

  @Get('finance/opex-transactions')
  async getOpexTransactions(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.getOpexTransactions();
  }

  @Post('finance/opex')
  async createOpex(
    @Body() body: CreateOpexDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.financeService.createOpexSafe({
      ...body,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      userId: req.user!.id,
    });
  }
}
