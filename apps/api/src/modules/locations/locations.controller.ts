import { Controller, Get, Param } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('departments')
  getDepartments() {
    return this.locationsService.getDepartments();
  }

  @Get('municipalities/:departmentId')
  getMunicipalities(@Param('departmentId') departmentId: string) {
    return this.locationsService.getMunicipalities(departmentId);
  }
}
