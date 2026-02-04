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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get('list')
  findAll(@Query('collection') collection?: string) {
    return this.productsService.findAll(collection);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    console.log(`[ProductsController] Update request for ID: ${id}`);
    console.log(
      `[ProductsController] Payload keys: ${Object.keys(updateProductDto).join(', ')}`,
    );
    if (updateProductDto.variants) {
      console.log(
        `[ProductsController] Variants count: ${updateProductDto.variants.length}`,
      );
      console.log(
        `[ProductsController] First variant: ${JSON.stringify(updateProductDto.variants[0])}`,
      );
    } else {
      console.warn(
        '[ProductsController] WARNING: No variants received in payload!',
      );
    }
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.remove(id);
  }
}
