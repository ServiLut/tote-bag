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
    return this.b2bService.createQuote(createQuoteDto, logo);
  }

  @Get('quotes')
  findAll() {
    return this.b2bService.findAll();
  }

  @Patch('quotes/:id/approve')
  approveDesign(@Param('id') id: string) {
    return this.b2bService.approveDesign(id);
  }
}
