import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  Headers,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RolesService } from '../roles/roles.service';
import { ReceiptPdfService, ExtendedOrder } from './orders.pdf.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly rolesService: RolesService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  private isPrivilegedOrderCreation(createOrderDto: CreateOrderDto) {
    return (
      createOrderDto.isManual === true ||
      createOrderDto.source === 'MANUAL' ||
      createOrderDto.initialStatus !== undefined ||
      createOrderDto.manualDiscountType !== undefined ||
      createOrderDto.manualDiscountValue !== undefined
    );
  }

  private sanitizePublicOrderPayload(
    createOrderDto: CreateOrderDto,
  ): CreateOrderDto {
    return {
      ...this.stripClientControlledItemFields(createOrderDto),
      isManual: false,
      source: 'ECOMMERCE',
      initialStatus: 'PENDIENTE_PAGO',
      manualDiscountType: undefined,
      manualDiscountValue: undefined,
      paymentReceiptUrl: undefined,
    };
  }

  private validatePrivilegedOrderCreation(createOrderDto: CreateOrderDto) {
    const normalizedInitialStatus = createOrderDto.initialStatus?.trim();
    const normalizedPaymentReceiptUrl =
      createOrderDto.paymentReceiptUrl?.trim() || undefined;

    if (
      normalizedInitialStatus &&
      !['PENDIENTE_PAGO', 'PAGADA'].includes(normalizedInitialStatus)
    ) {
      throw new BadRequestException(
        'Solo puedes crear pedidos manuales en pendiente de pago o pagados.',
      );
    }

    if (
      normalizedInitialStatus === 'PAGADA' &&
      !normalizedPaymentReceiptUrl
    ) {
      throw new BadRequestException(
        'Debes adjuntar soporte del pago para crear una orden manual pagada.',
      );
    }

    if (
      normalizedPaymentReceiptUrl &&
      normalizedInitialStatus !== 'PAGADA'
    ) {
      throw new BadRequestException(
        'El soporte de pago solo se admite al crear una orden manual pagada.',
      );
    }
  }

  private stripClientControlledItemFields(
    createOrderDto: CreateOrderDto,
  ): CreateOrderDto {
    return {
      ...createOrderDto,
      items: createOrderDto.items.map((item) => ({
        ...item,
        price: undefined,
      })),
    };
  }

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: RequestWithUser,
    @Headers('x-idempotency-key') xIdempotencyKey?: string,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ) {
    const actorUserId = req.user?.id;
    const idempotencyKey = xIdempotencyKey ?? idempotencyKeyHeader;
    const requiresOperationalPrivileges =
      this.isPrivilegedOrderCreation(createOrderDto);

    if (requiresOperationalPrivileges) {
      this.validatePrivilegedOrderCreation(createOrderDto);

      if (!actorUserId) {
        throw new UnauthorizedException('User not authenticated');
      }

      const canCreateManualOrders = await this.rolesService.hasPermission(
        actorUserId,
        'orders',
        'create',
      );

      if (!canCreateManualOrders) {
        throw new ForbiddenException('Insufficient permissions');
      }

      return this.ordersService.create(
        this.stripClientControlledItemFields(createOrderDto),
        actorUserId,
        {
          idempotencyKey,
        },
      );
    }

    return this.ordersService.create(
      this.sanitizePublicOrderPayload(createOrderDto),
      actorUserId,
      {
        idempotencyKey,
      },
    );
  }

  @Get()
  @RequirePermissions({ resource: 'orders', action: 'read' })
  findAll(
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.findAll({
      status,
      source,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    });
  }

  @Get('accounts-receivable')
  @RequirePermissions({ resource: 'orders', action: 'read' })
  getAccountsReceivable() {
    return this.ordersService.getAccountsReceivable();
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;

    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.id !== userId) {
      const canReadAnyOrder = await this.rolesService.hasPermission(
        user.id,
        'orders',
        'read',
      );

      if (!canReadAnyOrder) {
        throw new ForbiddenException('Cannot access another user orders');
      }
    }

    return this.ordersService.findByUser(userId);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'orders', action: 'read' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'orders', action: 'update' })
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'orders', action: 'cancel' })
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Post(':id/payments')
  @RequirePermissions({ resource: 'orders', action: 'update' })
  registerOrderPayment(
    @Param('id') id: string,
    @Body() body: CreateOrderPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.registerOrderPayment(id, body, req.user?.id);
  }

  @Get(':id/receipt')
  @RequirePermissions({ resource: 'orders', action: 'read' })
  async generateReceipt(@Param('id') id: string, @Res() res: Response) {
    const order = await this.ordersService.findOneWithDetails(id);
    if (!order) throw new NotFoundException('Orden no encontrada');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Recibo_Orden_#${order.orderNumber}_ToteBag.pdf`,
    );

    return this.receiptPdfService.generateSaleReceipt(
      res,
      order as unknown as ExtendedOrder,
    );
  }
}
