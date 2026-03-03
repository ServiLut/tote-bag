import { Controller, Get, Post, Body, UseGuards, Request, Query, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { FinanceService } from './finance.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService
  ) {}

  @Get('detailed')
  async getDetailedInventory() {
    return this.inventoryService.getDetailedInventory();
  }

  @Get('movements')
  async getInventoryMovements() {
    return this.inventoryService.getInventoryMovements();
  }

  @Post('batch')
  async createBatch(@Body() body: any, @Request() req: any) {
    const userId = req.user?.id || 'system-admin'; // Fallback for manual testing
    return this.inventoryService.createBatch({
      ...body,
      purchaseDate: new Date(body.purchaseDate),
      userId,
    });
  }

  @Get('batches')
  async findAllBatches() {
    return this.inventoryService.findAllBatches();
  }

  @Get('suppliers')
  async findAllSuppliers() {
    return this.financeService.findAllSuppliers();
  }

  @Post('suppliers')
  async createSupplier(@Body() body: any) {
    return this.financeService.createSupplier(body);
  }

  @Get('suppliers/:id')
  async getSupplierDetails(@Param('id') id: string) {
    return this.financeService.getSupplierDetails(id);
  }

  @Post('suppliers/:id/payments')
  async createSupplierPayment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const userId = req.user?.id || 'system-admin';
    return this.financeService.createSupplierPayment({
      ...body,
      supplierId: id,
      userId,
    });
  }

  @Get('finance/summary')
  async getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.financeService.getFinancialSummary(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get('finance/cash-flow')
  async getCashFlowData(@Query('period') period?: 'daily' | 'monthly') {
    return this.financeService.getCashFlowData(period);
  }

  @Get('finance/opex-categories')
  async getOpexCategories() {
    return this.financeService.getOpexCategories();
  }

  @Get('finance/opex-transactions')
  async getOpexTransactions() {
    return this.financeService.getOpexTransactions();
  }

  @Post('finance/opex')
  async createOpex(@Body() body: any, @Request() req: any) {
    const userId = req.user?.id || 'system-admin';
    return this.financeService.createOpex({
      ...body,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      userId,
    });
  }
}
