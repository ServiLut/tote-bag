import { Global, Module } from '@nestjs/common';
import { DebugRoleContextService } from './debug-role-context.service';

@Global()
@Module({
  providers: [DebugRoleContextService],
  exports: [DebugRoleContextService],
})
export class DebugRoleContextModule {}
