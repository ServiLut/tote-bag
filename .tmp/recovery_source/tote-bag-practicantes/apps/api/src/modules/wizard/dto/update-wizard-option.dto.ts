import { PartialType } from '@nestjs/swagger';
import { CreateWizardOptionDto } from './create-wizard-option.dto';

export class UpdateWizardOptionDto extends PartialType(CreateWizardOptionDto) {}
