import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgePostDto } from './dto/create-knowledge-post.dto';
import { UpdateKnowledgePostDto } from './dto/update-knowledge-post.dto';
import { QueryKnowledgePostsDto } from './dto/query-knowledge-posts.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  KNOWLEDGE_ATTACHMENT_MAX_BYTES,
  KNOWLEDGE_IMAGE_MAX_BYTES,
} from './knowledge.constants';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@Controller('knowledge-posts')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @RequirePermissions({ resource: 'knowledge-posts', action: 'read' })
  findAll(@Query() query: QueryKnowledgePostsDto) {
    return this.knowledgeService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'knowledge-posts', action: 'read' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.knowledgeService.findOne(id);
  }

  @Post()
  @RequirePermissions({ resource: 'knowledge-posts', action: 'create' })
  create(
    @Body() createKnowledgePostDto: CreateKnowledgePostDto,
    @Req() req: RequestWithUser,
  ) {
    return this.knowledgeService.create(createKnowledgePostDto, req.user?.id);
  }

  @Post('upload-image')
  @RequirePermissions({ resource: 'knowledge-posts', action: 'create' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: KNOWLEDGE_IMAGE_MAX_BYTES,
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar una imagen para subir.');
    }

    return this.knowledgeService.uploadImage(file);
  }

  @Post('upload-attachment')
  @RequirePermissions({ resource: 'knowledge-posts', action: 'create' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: KNOWLEDGE_ATTACHMENT_MAX_BYTES,
      },
    }),
  )
  uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo para subir.');
    }

    return this.knowledgeService.uploadAttachment(file);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'knowledge-posts', action: 'update' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateKnowledgePostDto: UpdateKnowledgePostDto,
    @Req() req: RequestWithUser,
  ) {
    return this.knowledgeService.update(
      id,
      updateKnowledgePostDto,
      req.user?.id,
    );
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'knowledge-posts', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.knowledgeService.remove(id);
  }
}
