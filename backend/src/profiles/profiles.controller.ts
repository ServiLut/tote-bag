import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  findAll(@Query('role') role?: 'ADMIN' | 'CUSTOMER') {
    if (role) {
      return this.profilesService.findAllByRole(role);
    }
    return this.profilesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }
}
