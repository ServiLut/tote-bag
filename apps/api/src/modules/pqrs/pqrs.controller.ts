import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { PqrsService } from './pqrs.service';
import { CreatePqrsDto } from './dto/create-pqrs.dto';
import { UpdatePqrsTicketDto } from './dto/update-pqrs-ticket.dto';
import { FindPqrsDto } from './dto/find-pqrs.dto';
import { RolesService } from '../roles/roles.service';
import { WHITELISTED_OPERATOR_EMAILS } from '../../common/constants/whitelisted-operator-emails';

interface RequestWithUser {
  user?: {
    id: string;
    email?: string | null;
  };
}

@Controller('pqrs')
export class PqrsController {
  constructor(
    private readonly pqrsService: PqrsService,
    private readonly rolesService: RolesService,
  ) {}

  private isWhitelistedOperator(req: RequestWithUser) {
    const normalizedEmail = req.user?.email?.trim().toLowerCase();
    return normalizedEmail
      ? WHITELISTED_OPERATOR_EMAILS.has(normalizedEmail)
      : false;
  }

  @Post()
  create(@Body() dto: CreatePqrsDto) {
    return this.pqrsService.create(dto);
  }

  @Get('count')
  async count(@Req() req: RequestWithUser, @Query() query: FindPqrsDto) {
    await this.ensureReadAccess(req);
    return this.pqrsService.countByStatus(query.status);
  }

  @Get()
  async findAll(@Req() req: RequestWithUser, @Query() query: FindPqrsDto) {
    await this.ensureReadAccess(req);
    return this.pqrsService.findAll(query.status);
  }

  private async ensureReadAccess(req: RequestWithUser) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    if (this.isWhitelistedOperator(req)) {
      return;
    }

    const [canReadOrders, canUpdateOrders] = await Promise.all([
      this.rolesService.hasPermission(user.id, 'orders', 'read'),
      this.rolesService.hasPermission(user.id, 'orders', 'update'),
    ]);

    if (!canReadOrders && !canUpdateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePqrsTicketDto,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    if (this.isWhitelistedOperator(req)) {
      return this.pqrsService.update(id, dto);
    }

    const canUpdateOrders = await this.rolesService.hasPermission(
      user.id,
      'orders',
      'update',
    );

    if (!canUpdateOrders) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.pqrsService.update(id, dto);
  }
}
