import { Module } from '@nestjs/common';
import { PersonalizationsService } from './personalizations.service';
import { PersonalizationsController } from './personalizations.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PersonalizationsController],
  providers: [PersonalizationsService],
})
export class PersonalizationsModule {}
