import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  UseInterceptors,
  UploadedFile,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { B2bService } from './b2b.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('b2b')
export class B2bController {
  constructor(private readonly b2bService: B2bService) {}

  @Post('quote')
  @UseInterceptors(FileInterceptor('logo'))
  createQuote(
    @Body() createQuoteDto: CreateQuoteDto,
    @UploadedFile() logo: Express.Multer.File,
  ) {
    // Note: logo validation might be relaxed for testing if file upload not fully set up in client
    return this.b2bService.createQuote(createQuoteDto, logo, {
      allowManualItems: false,
    });
  }

  @Post('quotes/manual')
  @RequirePermissions({ resource: 'b2b', action: 'manage' })
  @UseInterceptors(FileInterceptor('logo'))
  createManualQuote(
    @Body() createQuoteDto: CreateQuoteDto,
    @UploadedFile() logo: Express.Multer.File,
  ) {
    return this.b2bService.createQuote(createQuoteDto, logo, {
      allowManualItems: true,
    });
  }

  @Get('quotes')
  @RequirePermissions({ resource: 'b2b', action: 'manage' })
  findAll() {
    return this.b2bService.findAll();
  }

  @Patch('quotes/:id/approve')
  @RequirePermissions({ resource: 'b2b', action: 'manage' })
  approveDesign(@Param('id') id: string) {
    return this.b2bService.approveDesign(id);
  }
}
