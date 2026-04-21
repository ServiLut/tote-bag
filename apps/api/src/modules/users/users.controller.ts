import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Role } from '../../generated/client/enums';
import { CreateCustomerDto } from './dto/create-customer.dto';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions({ resource: 'users', action: 'read' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post('customers')
  @RequirePermissions({ resource: 'users', action: 'update' })
  async createCustomer(
    @Body() data: CreateCustomerDto,
    @Req() req: RequestWithUser,
  ) {
    return this.usersService.createCustomer(data, req.user?.id);
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
