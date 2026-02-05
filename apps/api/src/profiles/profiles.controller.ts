import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { Request } from 'express';
import { Prisma } from '../generated/client/client';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

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
  findAll(
    @Query('role') role?: 'ADMIN' | 'CUSTOMER',
    @Query('department') department?: string,
    @Query('municipality') municipality?: string,
  ) {
    return this.profilesService.findAll({ role, department, municipality });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }
}
