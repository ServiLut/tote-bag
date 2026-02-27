import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WizardService } from './wizard.service';
import { CreateWizardOptionDto } from './dto/create-wizard-option.dto';
import { UpdateWizardOptionDto } from './dto/update-wizard-option.dto';

@Controller('wizard-options')
export class WizardController {
  constructor(private readonly wizardService: WizardService) {}

  @Get()
  findAll() {
    return this.wizardService.findAll();
  }

  @Get('grouped')
  findAllGrouped() {
    return this.wizardService.findAllGrouped();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.wizardService.findOne(id);
  }

  @Post()
  create(@Body() createWizardOptionDto: CreateWizardOptionDto) {
    return this.wizardService.create(createWizardOptionDto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateWizardOptionDto: UpdateWizardOptionDto,
  ) {
    return this.wizardService.update(id, updateWizardOptionDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.wizardService.remove(id);
  }
}
