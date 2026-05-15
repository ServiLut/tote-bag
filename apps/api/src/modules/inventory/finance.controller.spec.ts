import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '../../generated/client/client';
import { FinanceController } from './finance.controller';

describe('FinanceController gateway margin grid access', () => {
  const financeService = {
    getGatewayMarginGrid: jest.fn(),
  };
  const rolesService = {
    getEffectiveRole: jest.fn(),
  };

  let controller: FinanceController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FinanceController(
      financeService as never,
      rolesService as never,
    );
  });

  it('rejects unauthenticated gateway margin grid access', async () => {
    await expect(
      controller.getGatewayMarginGrid(
        {
          grossAmount: 119000,
          productCost: 40000,
        },
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(financeService.getGatewayMarginGrid).not.toHaveBeenCalled();
  });

  it('allows managers to use the gateway margin simulator', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.MANAGER,
    });
    financeService.getGatewayMarginGrid.mockReturnValue({
      current: { utilidadNeta: 10000 },
      targets: [],
    });

    await controller.getGatewayMarginGrid(
      {
        grossAmount: 119000,
        productCost: 40000,
        marginTarget: 40,
      },
      { user: { id: 'manager-1' } } as never,
    );

    expect(financeService.getGatewayMarginGrid).toHaveBeenCalledWith({
      grossAmount: 119000,
      productCost: 40000,
      marginTarget: 40,
    });
  });

  it('rejects customers from the gateway margin simulator', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.CUSTOMER,
    });

    await expect(
      controller.getGatewayMarginGrid(
        {
          grossAmount: 119000,
          productCost: 40000,
        },
        { user: { id: 'customer-1' } } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(financeService.getGatewayMarginGrid).not.toHaveBeenCalled();
  });
});
