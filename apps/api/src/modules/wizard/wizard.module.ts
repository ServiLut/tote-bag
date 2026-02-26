import { Module } from '@nestjs/common';
import { WizardService } from './wizard.service';
import { WizardController } from './wizard.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WizardController],
  providers: [WizardService],
  exports: [WizardService],
})
export class WizardModule {}
