import { Role } from '../../generated/client/enums';
import { ManagerApprovalsService } from './manager-approvals.service';

describe('ManagerApprovalsService', () => {
  const prisma = {
    managerApproval: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const rolesService = {
    getEffectiveRole: jest.fn(),
  };

  let service: ManagerApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ManagerApprovalsService(prisma as never, rolesService as never);
  });

  it('auto-approves inline for ADMIN users', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.ADMIN,
    });
    prisma.managerApproval.create.mockResolvedValue({
      id: 'approval-1',
      status: 'USED',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.requireApproval({
      actorUserId: 'admin-1',
      resource: 'products',
      action: 'update-output-prices',
      entity: 'Product',
      entityId: 'product-1',
    });

    expect(prisma.managerApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedByUserId: 'admin-1',
          approvedByUserId: 'admin-1',
          usedByUserId: 'admin-1',
        }),
      }),
    );
    expect(result).toEqual({
      id: 'approval-1',
      status: 'USED',
    });
  });

  it('allows ADMIN users to create explicit approvals', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.ADMIN,
    });
    prisma.managerApproval.create.mockResolvedValue({
      id: 'approval-2',
      resource: 'products',
      action: 'update-output-prices',
      entity: 'Product',
      entityId: 'product-2',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.createApproval('admin-1', {
      resource: 'products',
      action: 'update-output-prices',
      entity: 'Product',
      entityId: 'product-2',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'approval-2',
      }),
    );
  });
});
