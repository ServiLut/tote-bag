import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CreateShippingProviderDto } from './dto/create-provider.dto';
import { UpdateShippingProviderDto } from './dto/update-provider.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // --- Providers ---

  @Post('providers')
  @RequirePermissions({ resource: 'shipping', action: 'create' })
  @ApiOperation({ summary: 'Crear proveedor de envío' })
  createProvider(@Body() dto: CreateShippingProviderDto) {
    return this.shippingService.createProvider(dto);
  }

  @Get('providers')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Listar proveedores de envío' })
  getProviders() {
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
  @ApiOperation({ summary: 'Actualizar proveedor de envío' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateShippingProviderDto) {
    return this.shippingService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  @RequirePermissions({ resource: 'shipping', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar proveedor de envío' })
  deleteProvider(@Param('id') id: string) {
    return this.shippingService.deleteProvider(id);
  }

  // --- Shipments ---

  @Get('shipments/pending')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Listar envíos pendientes (órdenes pagadas)' })
  getPendingShipments() {
    return this.shippingService.getPendingShipments();
  }

  @Get('shipments')
  @RequirePermissions({ resource: 'shipping', action: 'read' })
  @ApiOperation({ summary: 'Listar todos los envíos' })
  getShipments() {
    return this.shippingService.getShipments();
  }

  @Patch('shipments/:orderId')
  @RequirePermissions({ resource: 'shipping', action: 'update' })
  @ApiOperation({ summary: 'Actualizar estado de envío y número de guía' })
  updateShipment(@Param('orderId') orderId: string, @Body() dto: UpdateShipmentDto) {
    return this.shippingService.updateShipment(orderId, dto);
  }
}
