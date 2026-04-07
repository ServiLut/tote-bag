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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { RolesService } from '../roles/roles.service';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly rolesService: RolesService,
  ) {}

  private async ensurePermission(
    req: RequestWithUser,
    action: 'create' | 'update' | 'delete',
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

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
    await this.ensurePermission(req, 'create');
    return this.collectionsService.create(createCollectionDto);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    await this.ensurePermission(req, 'update');
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RequestWithUser,
  ) {
    await this.ensurePermission(req, 'delete');
    return this.collectionsService.remove(id);
  }
}
