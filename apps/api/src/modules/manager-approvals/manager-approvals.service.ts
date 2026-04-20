import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { ManagerApprovalStatus, Role } from '../../generated/client/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { CreateManagerApprovalDto } from './dto/create-manager-approval.dto';

type ApprovalScope = {
  resource: string;
  action: string;
  entity: string;
  entityId?: string | null;
};

type RequireApprovalInput = ApprovalScope & {
  actorUserId: string;
  approvalId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class ManagerApprovalsService {
  private readonly defaultExpirationMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async createApproval(approverUserId: string, data: CreateManagerApprovalDto) {
    await this.assertManager(approverUserId);

    const expiresAt = this.buildExpiration(data.expiresInMinutes);

    const approval = await this.prisma.managerApproval.create({
      data: {
        resource: data.resource.trim(),
        action: data.action.trim(),
        entity: data.entity.trim(),
        entityId: data.entityId?.trim() || null,
        reason: data.reason?.trim() || null,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        requestedByUserId: data.requestedByUserId?.trim() || null,
        approvedByUserId: approverUserId,
        expiresAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'MANAGER_APPROVAL_CREATED',
        entity: 'ManagerApproval',
        entityId: approval.id,
        userId: approverUserId,
        payload: {
          resource: approval.resource,
          approvalAction: approval.action,
          targetEntity: approval.entity,
          targetEntityId: approval.entityId,
          expiresAt: approval.expiresAt.toISOString(),
        },
        newData: approval as unknown as Prisma.InputJsonValue,
      },
    });

    return approval;
  }

  async findRecent(actorUserId: string) {
    await this.assertManager(actorUserId);

    return this.prisma.managerApproval.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        approvedBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        usedBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async requireApproval(input: RequireApprovalInput) {
    const role = await this.getEffectiveRole(input.actorUserId);
    const tx = input.tx ?? this.prisma;

    if (role === Role.MANAGER) {
      return this.createInlineManagerApproval(input, tx);
    }

    if (!input.approvalId) {
      throw new ForbiddenException(
        'Esta operacion requiere aprobacion gerencial.',
      );
    }

    const approval = await tx.managerApproval.findUnique({
      where: { id: input.approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Aprobacion gerencial no encontrada.');
    }

    if (approval.status !== ManagerApprovalStatus.APPROVED) {
      throw new BadRequestException('La aprobacion gerencial no esta vigente.');
    }

    if (approval.usedAt) {
      throw new BadRequestException('La aprobacion gerencial ya fue usada.');
    }

    if (approval.expiresAt.getTime() < Date.now()) {
      await tx.managerApproval.update({
        where: { id: approval.id },
        data: { status: ManagerApprovalStatus.EXPIRED },
      });
      throw new BadRequestException('La aprobacion gerencial expiro.');
    }

    this.assertScopeMatches(approval, input);

    const updatedApproval = await tx.managerApproval.update({
      where: { id: approval.id },
      data: {
        status: ManagerApprovalStatus.USED,
        usedAt: new Date(),
        usedByUserId: input.actorUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'MANAGER_APPROVAL_USED',
        entity: input.entity,
        entityId: input.entityId ?? null,
        userId: input.actorUserId,
        payload: {
          approvalId: approval.id,
          resource: input.resource,
          approvalAction: input.action,
          targetEntity: input.entity,
          targetEntityId: input.entityId ?? null,
        },
        previousData: approval as unknown as Prisma.InputJsonValue,
        newData: updatedApproval as unknown as Prisma.InputJsonValue,
      },
    });

    return updatedApproval;
  }

  private async createInlineManagerApproval(
    input: RequireApprovalInput,
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    const now = new Date();
    const approval = await tx.managerApproval.create({
      data: {
        resource: input.resource,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        status: ManagerApprovalStatus.USED,
        reason: input.reason?.trim() || 'Aprobacion directa del gerente',
        metadata: input.metadata ?? Prisma.JsonNull,
        requestedByUserId: input.actorUserId,
        approvedByUserId: input.actorUserId,
        usedByUserId: input.actorUserId,
        expiresAt: new Date(now.getTime() + 60_000),
        usedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'MANAGER_APPROVAL_INLINE',
        entity: input.entity,
        entityId: input.entityId ?? null,
        userId: input.actorUserId,
        payload: {
          approvalId: approval.id,
          resource: input.resource,
          approvalAction: input.action,
          targetEntity: input.entity,
          targetEntityId: input.entityId ?? null,
        },
        newData: approval as unknown as Prisma.InputJsonValue,
      },
    });

    return approval;
  }

  private async assertManager(userId: string) {
    const role = await this.getEffectiveRole(userId);

    if (role !== Role.MANAGER) {
      throw new ForbiddenException(
        'Solo los usuarios GERENTE pueden emitir aprobaciones gerenciales.',
      );
    }
  }

  private async getEffectiveRole(userId: string) {
    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);
    return effectiveRole;
  }

  private buildExpiration(expiresInMinutes?: number) {
    const minutes = expiresInMinutes ?? this.defaultExpirationMinutes;
    return new Date(Date.now() + minutes * 60_000);
  }

  private assertScopeMatches(approval: ApprovalScope, expected: ApprovalScope) {
    const matches =
      approval.resource === expected.resource &&
      approval.action === expected.action &&
      approval.entity === expected.entity &&
      (!approval.entityId || approval.entityId === expected.entityId);

    if (!matches) {
      throw new BadRequestException(
        'La aprobacion gerencial no corresponde a esta operacion.',
      );
    }
  }
}
