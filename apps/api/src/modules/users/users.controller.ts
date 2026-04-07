import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Role } from '../../generated/client/enums';

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
