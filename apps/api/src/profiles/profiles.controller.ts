import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

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
