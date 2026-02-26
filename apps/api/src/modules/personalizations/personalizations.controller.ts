import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { PersonalizationsService } from './personalizations.service';

@Controller('personalizations')
export class PersonalizationsController {
  constructor(private readonly personalizationsService: PersonalizationsService) {}

  @Get()
  async findAll() {
    return this.personalizationsService.findAll();
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.personalizationsService.update(id, data);
  }
}
