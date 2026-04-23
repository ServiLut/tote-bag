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
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Role } from '../../generated/client/enums';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { RolesService } from '../roles/roles.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensureManageCustomerPermission(userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const [canUpdateUsers, canCreateOrders] = await Promise.all([
      this.rolesService.hasPermission(userId, 'users', 'update'),
      this.rolesService.hasPermission(userId, 'orders', 'create'),
    ]);

    if (!canUpdateUsers && !canCreateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  @Get()
  @RequirePermissions({ resource: 'users', action: 'read' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post('customers')
  async createCustomer(
    @Body() data: CreateCustomerDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureManageCustomerPermission(req.user?.id);
    return this.usersService.createCustomer(data, req.user?.id);
  }

  @Patch('customers/:id')
  async updateCustomer(
    @Param('id') id: string,
    @Body() data: UpdateCustomerDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureManageCustomerPermission(req.user?.id);
    return this.usersService.updateCustomer(id, data, req.user?.id);
  }

  @Patch('customers/:id/status')
  async updateCustomerStatus(
    @Param('id') id: string,
    @Body() data: UpdateCustomerStatusDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensureManageCustomerPermission(req.user?.id);
    return this.usersService.updateCustomerStatus(
      id,
      data.isActive,
      req.user?.id,
    );
  }

  @Delete('customers/:id')
  async deleteCustomer(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.ensureManageCustomerPermission(req.user?.id);
    return this.usersService.deleteCustomer(id, req.user?.id);
  }

  @Patch(':id/role')
  @RequirePermissions({ resource: 'users', action: 'update' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @Req() req: RequestWithUser,
  ) {
    return this.usersService.updateUserRole(id, role, req.user?.id);
  }
}
