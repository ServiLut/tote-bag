import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions({ resource: 'audit', action: 'read' })
  async findAll(
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.auditService.findAll({
      entity,
      action,
      userId,
      skip,
      take,
    });
  }

  @Get(':id')
  @RequirePermissions({ resource: 'audit', action: 'read' })
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
