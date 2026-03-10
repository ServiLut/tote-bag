import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { Request } from 'express';
import { Prisma } from '../../generated/client/client';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('me')
  async getMe(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    return this.profilesService.findByUserId(user.id);
  }

  @Patch('me')
  async updateMe(
    @Req() req: RequestWithUser,
    @Body() data: Prisma.ProfileUpdateInput,
  ) {
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    return this.profilesService.update(user.id, data);
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query('role') role?: 'ADMIN' | 'CUSTOMER',
    @Query('department') department?: string,
    @Query('municipality') municipality?: string,
  ) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();

    const canReadUsers = await this.rolesService.hasPermission(
      user.id,
      'users',
      'read',
    );
    const canCreateOrders = await this.rolesService.hasPermission(
      user.id,
      'orders',
      'create',
    );

    if (!canReadUsers && !canCreateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.profilesService.findAll({ role, department, municipality });
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();

    const canReadUsers = await this.rolesService.hasPermission(
      user.id,
      'users',
      'read',
    );

    if (!canReadUsers) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.profilesService.findOne(id);
  }
}
