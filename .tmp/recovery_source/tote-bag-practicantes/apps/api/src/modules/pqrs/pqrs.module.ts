import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PqrsController } from './pqrs.controller';
import { PqrsService } from './pqrs.service';

@Module({
  imports: [PrismaModule],
  controllers: [PqrsController],
  providers: [PqrsService],
})
export class PqrsModule {}
