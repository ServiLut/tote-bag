import { Controller, Get, Put, Post, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { PersonalizationsService } from './personalizations.service';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { CreatePersonalizationDto } from './dto/create-personalization.dto';

@Controller('personalizations')
export class PersonalizationsController {
  constructor(
    private readonly personalizationsService: PersonalizationsService,
  ) {}

  @Get()
  async findAll() {
    return this.personalizationsService.findAll();
  }

  @Post()
  async create(@Body() data: CreatePersonalizationDto) {
    return this.personalizationsService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdatePersonalizationDto,
  ) {
    return this.personalizationsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.personalizationsService.remove(id);
  }
}
