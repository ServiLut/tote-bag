import { Module, Global } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
