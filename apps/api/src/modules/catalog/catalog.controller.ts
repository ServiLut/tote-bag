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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @RequirePermissions({ resource: 'products', action: 'create' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.catalogService.create(createProductDto);
  }

  @Get('products')
  findAll(
    @Query('collection') collection?: string,
    @Query('lines') lines?: string,
    @Query('sizes') sizes?: string,
    @Query('qualities') qualities?: string,
    @Query('materials') materials?: string,
    @Query('status') status?: string,
    @Query('isCustomizable') isCustomizable?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.findAll({
      collectionId: collection,
      line: lines,
      size: sizes,
      quality: qualities,
      material: materials,
      status,
      isCustomizable: isCustomizable === 'true',
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      search,
    });
  }

  @Get('search')
  searchSuggestions(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.catalogService.searchSuggestions(
      q?.trim() || '',
      limit ? Number(limit) : undefined,
    );
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }

  @Get('products/:slug/config')
  getProductConfig(@Param('slug') slug: string) {
    return this.catalogService.getProductConfig(slug);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'products', action: 'update' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.catalogService.update(id, updateProductDto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'products', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalogService.remove(id);
  }
}
