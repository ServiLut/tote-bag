import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Put,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Req,
  Query,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PersonalizationsService } from './personalizations.service';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { CreatePersonalizationDto } from './dto/create-personalization.dto';
import { CreateSignedDesignUploadDto } from './dto/create-signed-design-upload.dto';
import { CreatePersonalizationRequestDto } from './dto/create-personalization-request.dto';
import { UpdatePersonalizationRequestDto } from './dto/update-personalization-request.dto';
import { ApprovePersonalizationRequestDto } from './dto/approve-personalization-request.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

interface RequestWithUser {
  user?: {
    id: string;
    email?: string | null;
  };
}

@Controller('personalizations')
export class PersonalizationsController {
  constructor(
    private readonly personalizationsService: PersonalizationsService,
  ) {}

  @Get()
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async findAll() {
    return this.personalizationsService.findAll();
  }

  @Post()
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async create(@Body() data: CreatePersonalizationDto) {
    return this.personalizationsService.create(data);
  }

  @Post('signed-upload')
  async createSignedUpload(@Body() data: CreateSignedDesignUploadDto) {
    return this.personalizationsService.createSignedUpload(data);
  }

  @Post('upload-design')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDesign(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo para subir.');
    }

    return this.personalizationsService.uploadDesign(file);
  }

  @Get('requests')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async findRequests(@Query('status') status?: string) {
    return this.personalizationsService.findRequests(status);
  }

  @Post('requests')
  async createRequest(
    @Req() req: RequestWithUser,
    @Body() data: CreatePersonalizationRequestDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.personalizationsService.createRequest(req.user.id, data);
  }

  @Patch('requests/:id')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async updateRequest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdatePersonalizationRequestDto,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.personalizationsService.updateRequest(id, data, req.user.id);
  }

  @Patch('requests/:id/approve')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  @UseInterceptors(FileInterceptor('file'))
  async approveRequest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: ApprovePersonalizationRequestDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.personalizationsService.approveRequest(
      id,
      data,
      req.user.id,
      file,
    );
  }

  @Put(':id')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdatePersonalizationDto,
  ) {
    return this.personalizationsService.update(id, data);
  }

  @Delete(':id')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  @RequirePermissions({ resource: 'personalizations', action: 'manage' })
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.personalizationsService.remove(id);
  }
}
