import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.catalogService.create(createProductDto);
  }

  @Get('products')
  findAll(
    @Query('collection') collection?: string,
    @Query('line') line?: string,
    @Query('size') size?: string,
    @Query('quality') quality?: string,
    @Query('material') material?: string,
    @Query('status') status?: string,
    @Query('isCustomizable') isCustomizable?: string,
  ) {
    return this.catalogService.findAll({
      collectionId: collection,
      line,
      size,
      quality,
      material,
      status,
      isCustomizable: isCustomizable === 'true',
    });
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    console.log(`[CatalogController] Update request for ID: ${id}`);
    console.log(
      `[CatalogController] Payload keys: ${Object.keys(updateProductDto).join(', ')}`,
    );
    if (updateProductDto.variants) {
      console.log(
        `[CatalogController] Variants count: ${updateProductDto.variants.length}`,
      );
      console.log(
        `[CatalogController] First variant: ${JSON.stringify(updateProductDto.variants[0])}`,
      );
    } else {
      console.warn(
        '[CatalogController] WARNING: No variants received in payload!',
      );
    }
    return this.catalogService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalogService.remove(id);
  }
}
