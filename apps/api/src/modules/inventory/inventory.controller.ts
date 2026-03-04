import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  Query,
  Param,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { FinanceService } from './finance.service';
import { CreatePurchaseBatchDto } from './dto/create-purchase-batch.dto';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
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
  async createBatch(
    @Body()
    body: {
      productId: string;
      supplierId: string;
      quantityReceived: number;
      unitCost: number;
      purchaseDate: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id'; // Fallback for manual testing
    return this.inventoryService.createBatch({
      ...body,
      purchaseDate: new Date(body.purchaseDate),
      userId,
    });
  }

  @Post('receive-batch')
  async receiveBatch(
    @Body() data: CreatePurchaseBatchDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id';
    return this.inventoryService.receiveBatch({
      ...data,
      userId,
    });
  }

  @Post('batches')
  async createPurchaseBatch(
    @Body() data: CreatePurchaseBatchDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id';
    return this.inventoryService.createPurchaseBatch({
      ...data,
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
  async createSupplier(
    @Body()
    body: {
      name: string;
      nit: string;
      contact?: string;
      phone?: string;
      email?: string;
    },
  ) {
    return this.financeService.createSupplier(body);
  }

  @Get('suppliers/:id')
  async getSupplierDetails(@Param('id') id: string) {
    return this.financeService.getSupplierDetails(id);
  }

  @Post('suppliers/:id/payments')
  async createSupplierPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; description: string },
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id';
    return this.financeService.createSupplierPayment({
      ...body,
      supplierId: id,
      userId,
    });
  }

  @Get('finance/summary')
  async getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getFinancialSummary(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
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
  async createOpex(
    @Body()
    body: {
      amount: number;
      description: string;
      opexCategoryId: string;
      createdAt?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'auth0|admin-test-id';
    return this.financeService.createOpex({
      ...body,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      userId,
    });
  }
}
