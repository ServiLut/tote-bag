import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Request } from 'express';
import { ProfilesService } from '../profiles/profiles.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly profilesService: ProfilesService,
  ) {}

  private async getProfile(req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    const profile = await this.profilesService.findByUserId(user.id);
    if (!profile) throw new UnauthorizedException('Profile not found');

    return profile;
  }

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    const profile = await this.getProfile(req);
    return this.addressesService.create(profile.id, createAddressDto);
  }

  @Get()
  async findAll(@Req() req: RequestWithUser) {
    const profile = await this.getProfile(req);
    return this.addressesService.findAll(profile.id);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const profile = await this.getProfile(req);
    return this.addressesService.findOne(id, profile.id);
  }

  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    const profile = await this.getProfile(req);
    return this.addressesService.update(id, profile.id, updateAddressDto);
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    const profile = await this.getProfile(req);
    return this.addressesService.remove(id, profile.id);
  }
}
