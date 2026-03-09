import { Controller, Get, Patch, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Role } from '../../generated/client/enums';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions({ resource: 'users', action: 'read' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @RequirePermissions({ resource: 'users', action: 'update' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.usersService.updateUserRole(id, role);
  }
}
