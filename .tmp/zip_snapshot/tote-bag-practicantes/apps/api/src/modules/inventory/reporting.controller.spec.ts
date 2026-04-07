import { BadRequestException } from '@nestjs/common';
import { ReportingController } from './reporting.controller';

describe('ReportingController', () => {
  const reportingService = {
    getClosingReport: jest.fn(),
    getAccountingReport: jest.fn(),
    generateAccountingExcel: jest.fn(),
    generateAccountingPDF: jest.fn(),
    getInventoryValuation: jest.fn(),
  };
  const rolesService = {
    getEffectiveRole: jest.fn(),
  };

  let controller: ReportingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReportingController(
      reportingService as never,
      rolesService as never,
    );
    rolesService.getEffectiveRole.mockResolvedValue({ effectiveRole: 'ADMIN' });
  });

  it('expande endDate al final del dia para el cierre', async () => {
    reportingService.getClosingReport.mockResolvedValue({ ok: true });

    await controller.getClosingReport('2026-03-01', '2026-03-31', {
      user: { id: 'admin-1' },
    });

    expect(reportingService.getClosingReport).toHaveBeenCalledWith(
      new Date('2026-03-01T00:00:00'),
      new Date('2026-03-31T23:59:59.999'),
      'admin-1',
    );
  });

  it('rechaza fechas invalidas antes de consultar el servicio', async () => {
    await expect(
      controller.getAccountingReport('fecha-mala', '2026-03-31', {
        user: { id: 'admin-1' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(reportingService.getAccountingReport).not.toHaveBeenCalled();
  });
});
