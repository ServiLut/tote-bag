import {
  ForbiddenException,
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensurePermission(
    userId: string,
    action: 'create' | 'update' | 'delete',
  ) {
    const hasPermission = await this.rolesService.hasPermission(
      userId,
      'products',
      action,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  @Get()
  async findAll() {
    return this.collectionsService.findAll();
  }

  @Post()
  async create(
    @Body() createCollectionDto: CreateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }

    await this.ensurePermission(req.user.id, 'create');
    return this.collectionsService.create(createCollectionDto);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }

    await this.ensurePermission(req.user.id, 'update');
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }

    await this.ensurePermission(req.user.id, 'delete');
    return this.collectionsService.remove(id);
  }
}
