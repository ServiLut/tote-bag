import { Role } from '../../generated/client/enums';
import { ManagerApprovalsService } from './manager-approvals.service';

type ManagerApprovalCreateArgs = {
  data: {
    requestedByUserId?: string | null;
    approvedByUserId?: string | null;
    usedByUserId?: string | null;
  };
};

type ManagerApprovalRecord = {
  id: string;
  status?: string;
  resource?: string;
  action?: string;
  entity?: string;
  entityId?: string | null;
  expiresAt?: Date;
};

describe('ManagerApprovalsService', () => {
  const createManagerApproval =
    jest.fn<
      (args: ManagerApprovalCreateArgs) => Promise<ManagerApprovalRecord>
    >();
  const findManyManagerApprovals = jest.fn<() => Promise<unknown[]>>();
  const createAuditLog = jest.fn<() => Promise<Record<string, never>>>();
  const getEffectiveRole =
    jest.fn<(userId: string) => Promise<{ effectiveRole: Role }>>();

  const prisma = {
    managerApproval: {
      create: createManagerApproval,
      findMany: findManyManagerApprovals,
    },
    auditLog: {
      create: createAuditLog,
    },
  };

  const rolesService = {
    getEffectiveRole,
  };

  let service: ManagerApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ManagerApprovalsService(
      prisma as never,
      rolesService as never,
    );
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

    const expectedCreateData = expect.objectContaining({
      requestedByUserId: 'admin-1',
      approvedByUserId: 'admin-1',
      usedByUserId: 'admin-1',
    }) as unknown as ManagerApprovalCreateArgs['data'];

    expect(createManagerApproval).toHaveBeenCalledWith(
      expect.objectContaining<ManagerApprovalCreateArgs>({
        data: expectedCreateData,
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
