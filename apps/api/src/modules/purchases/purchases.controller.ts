import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../generated/client/client';
import { RolesService } from '../roles/roles.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { CreatePurchasePaymentDto } from './dto/create-purchase-payment.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { UpdatePurchasePaymentDto } from './dto/update-purchase-payment.dto';
import { PurchasesService } from './purchases.service';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('purchase-invoices')
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureAdmin(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden gestionar facturas de compra',
      );
    }
  }

  @Post()
  async createPurchaseInvoice(
    @Body() body: CreatePurchaseInvoiceDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.createPurchaseInvoice(body);
  }

  @Get()
  async findAllPurchaseInvoices(@Request() req: RequestWithUser) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.findAllPurchaseInvoices();
  }

  @Patch(':id')
  async updatePurchaseInvoice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdatePurchaseInvoiceDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.updatePurchaseInvoice(id, body);
  }

  @Post(':id/payments')
  async registerPurchaseInvoicePayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CreatePurchasePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.registerPurchaseInvoicePayment(id, body);
  }

  @Patch(':invoiceId/payments/:paymentId')
  async updatePurchaseInvoicePayment(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() body: UpdatePurchasePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.updatePurchaseInvoicePayment(
      invoiceId,
      paymentId,
      body,
    );
  }

  @Delete(':id')
  async deletePurchaseInvoice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestWithUser,
  ) {
    await this.ensureAdmin(req.user?.id);
    return this.purchasesService.deletePurchaseInvoice(id);
  }
}
