import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Request,
} from '@nestjs/common';
import { CreateManagerApprovalDto } from './dto/create-manager-approval.dto';
import { ManagerApprovalsService } from './manager-approvals.service';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('manager-approvals')
export class ManagerApprovalsController {
  constructor(
    private readonly managerApprovalsService: ManagerApprovalsService,
  ) {}

  @Post()
  create(
    @Body() body: CreateManagerApprovalDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    return this.managerApprovalsService.createApproval(req.user.id, body);
  }

  @Get()
  findRecent(@Request() req: RequestWithUser) {
    if (!req.user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    return this.managerApprovalsService.findRecent(req.user.id);
  }
}
