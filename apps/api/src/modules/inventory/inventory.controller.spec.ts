import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '../../generated/client/client';
import { InventoryController } from './inventory.controller';

describe('InventoryController suppliers access', () => {
  const inventoryService = {};
  const financeService = {
    findAllSuppliers: jest.fn(),
    createSupplier: jest.fn(),
  };
  const rolesService = {
    getEffectiveRole: jest.fn(),
  };

  let controller: InventoryController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InventoryController(
      inventoryService as never,
      financeService as never,
      rolesService as never,
    );
  });

  it('rejects unauthenticated supplier listing', async () => {
    await expect(
      controller.findAllSuppliers({} as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(financeService.findAllSuppliers).not.toHaveBeenCalled();
  });

  it('rejects non-admin supplier listing', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.MANAGER,
    });

    await expect(
      controller.findAllSuppliers({ user: { id: 'manager-1' } } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(financeService.findAllSuppliers).not.toHaveBeenCalled();
  });

  it('forwards supplier creation for admin users', async () => {
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.ADMIN,
    });
    financeService.createSupplier.mockResolvedValue({ id: 'supplier-1' });

    await controller.createSupplier(
      {
        name: 'Proveedor Uno',
        nit: '900123456-7',
        contact: 'Ana',
      },
      { user: { id: 'admin-1' } } as never,
    );

    expect(financeService.createSupplier).toHaveBeenCalledWith({
      name: 'Proveedor Uno',
      nit: '900123456-7',
      contact: 'Ana',
    });
  });
});
