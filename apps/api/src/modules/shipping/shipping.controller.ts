import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RolesService } from '../roles/roles.service';
import { ShippingPdfService } from './shipping.pdf.service';
import { ShippingService } from './shipping.service';
import { CreateShippingProviderDto } from './dto/create-provider.dto';
import { ProcessReturnDto } from './dto/process-return.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShippingProviderDto } from './dto/update-provider.dto';

interface RequestWithUser {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(
    private readonly shippingService: ShippingService,
    private readonly shippingPdfService: ShippingPdfService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureProviderAccessPermission(
    userId: string,
    shippingAction: 'create' | 'read',
  ) {
    const [hasShippingPermission, canCreateOrders] = await Promise.all([
      this.rolesService.hasPermission(userId, 'shipping', shippingAction),
      this.rolesService.hasPermission(userId, 'orders', 'create'),
    ]);

    if (!hasShippingPermission && !canCreateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async ensureShipmentAccessPermission(
    userId: string,
    shippingAction: 'read' | 'update',
  ) {
    const hasShippingPermission = await this.rolesService.hasPermission(
      userId,
      'shipping',
      shippingAction,
    );

    if (!hasShippingPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  @Post('providers')
  @ApiOperation({ summary: 'Crear proveedor de envio' })
  async createProvider(
    @Body() dto: CreateShippingProviderDto,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureProviderAccessPermission(user.id, 'create');

    return this.shippingService.createProvider(dto);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Listar proveedores de envio' })
  async getProviders(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureProviderAccessPermission(user.id, 'read');

    return this.shippingService.getProviders();
  }

  @Get('providers/:id')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Obtener proveedor por ID' })
  getProvider(@Param('id') id: string) {
    return this.shippingService.getProviderById(id);
  }

  @Patch('providers/:id')
  @RequirePermissions({ resource: 'shipping', action: 'update' })
  @ApiOperation({ summary: 'Actualizar proveedor de envio' })
  updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateShippingProviderDto,
  ) {
    return this.shippingService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  @RequirePermissions({ resource: 'shipping', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar proveedor de envio' })
  deleteProvider(@Param('id') id: string) {
    return this.shippingService.deleteProvider(id);
  }

  @Get('shipments/pending')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  @ApiOperation({ summary: 'Listar envios pendientes' })
  async getPendingShipments(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'read');

    return this.shippingService.getPendingShipments();
  }

  @Get('shipments')
  @ApiOperation({ summary: 'Listar todos los envios' })
  async getShipments(@Req() req: RequestWithUser): Promise<unknown> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'read');

    return this.shippingService.getShipments();
  }

  @Get('shipping-bags/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de bolsas de envio' })
  async getShippingBagAvailability(
    @Req() req: RequestWithUser,
  ): Promise<unknown> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'read');

    return this.shippingService.getShippingBagAvailability();
  }

  @Get('shipments/:orderId/supply-usage')
  @ApiOperation({ summary: 'Consultar consumo de insumos por envio' })
  async getShipmentSupplyUsage(
    @Param('orderId') orderId: string,
    @Req() req: RequestWithUser,
  ): Promise<unknown> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'read');

    return this.shippingService.getShipmentSupplyUsage(orderId);
  }

  @Patch('shipments/:orderId')
  @ApiOperation({ summary: 'Actualizar estado de envio y numero de guia' })
  async updateShipment(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateShipmentDto,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'update');

    return this.shippingService.updateShipment(orderId, dto, user.id);
  }

  @Delete('shipments/:orderId')
  @ApiOperation({
    summary: 'Eliminar un envio pendiente o listo para etiqueta',
  })
  async deleteShipment(
    @Param('orderId') orderId: string,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'update');

    return this.shippingService.deleteShipment(orderId, user.id);
  }

  @Post('shipments/:orderId/process-return')
  @ApiOperation({ summary: 'Procesar devolucion de un envio' })
  async processReturn(
    @Param('orderId') orderId: string,
    @Body() dto: ProcessReturnDto,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(req.user.id, 'update');

    return this.shippingService.processReturn(orderId, dto, req.user?.id);
  }

  @Get('shipments/:orderId/label')
  @ApiOperation({ summary: 'Generar etiqueta de envio en PDF' })
  async generateLabel(
    @Param('orderId') orderId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.ensureShipmentAccessPermission(user.id, 'read');

    const { order, shipment } =
      await this.shippingService.getOrderAndShipment(orderId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=label-${order.orderNumber}.pdf`,
    );

    return this.shippingPdfService.generateShippingLabel(res, order, shipment);
  }
}
