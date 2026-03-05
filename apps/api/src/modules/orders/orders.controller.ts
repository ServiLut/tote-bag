import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RolesService } from '../roles/roles.service';

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
  ) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @RequirePermissions({ resource: 'orders', action: 'read' })
  findAll(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.findAll({
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    });
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
}
