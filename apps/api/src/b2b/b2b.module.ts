import { Module } from '@nestjs/common';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [B2bController],
  providers: [B2bService],
})
export class B2bModule {}
