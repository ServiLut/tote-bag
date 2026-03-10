import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RolesService } from '../roles/roles.service';
import { ShippingPdfService } from './shipping.pdf.service';
import { ShippingService } from './shipping.service';
import { CreateShippingProviderDto } from './dto/create-provider.dto';
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

  @Post('providers')
  @RequirePermissions({ resource: 'shipping', action: 'create' })
  @ApiOperation({ summary: 'Crear proveedor de envio' })
  createProvider(@Body() dto: CreateShippingProviderDto) {
    return this.shippingService.createProvider(dto);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Listar proveedores de envio' })
  async getProviders(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();

    const [canReadShipping, canCreateOrders] = await Promise.all([
      this.rolesService.hasPermission(user.id, 'shipping', 'read'),
      this.rolesService.hasPermission(user.id, 'orders', 'create'),
    ]);

    if (!canReadShipping && !canCreateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }

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
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Listar envios pendientes' })
  getPendingShipments() {
    return this.shippingService.getPendingShipments();
  }

  @Get('shipments')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Listar todos los envios' })
  getShipments() {
    return this.shippingService.getShipments();
  }

  @Patch('shipments/:orderId')
  @RequirePermissions({ resource: 'shipping', action: 'update' })
  @ApiOperation({ summary: 'Actualizar estado de envio y numero de guia' })
  updateShipment(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shippingService.updateShipment(orderId, dto);
  }

  @Get('shipments/:orderId/label')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Generar etiqueta de envio en PDF' })
  async generateLabel(@Param('orderId') orderId: string, @Res() res: Response) {
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
