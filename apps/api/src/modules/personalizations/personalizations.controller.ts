import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { PersonalizationsService } from './personalizations.service';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';

@Controller('personalizations')
export class PersonalizationsController {
  constructor(
    private readonly personalizationsService: PersonalizationsService,
  ) {}

  @Get()
  async findAll() {
    return this.personalizationsService.findAll();
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdatePersonalizationDto,
  ) {
    return this.personalizationsService.update(id, data);
  }
}
