import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DebugRoleContextModule } from '../../common/context/debug-role-context.module';

@Module({
  imports: [PrismaModule, DebugRoleContextModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
