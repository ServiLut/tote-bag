import { PqrsService } from './pqrs.service';

describe('PqrsService', () => {
  it('returns an empty inbox when PQRS tickets cannot be loaded', async () => {
    const prisma = {
      pqrsTicket: {
        findMany: jest
          .fn()
          .mockRejectedValue(new Error('pqrs table unavailable')),
      },
    };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const service = new PqrsService(prisma as never);

    await expect(service.findAll('NUEVO')).resolves.toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'PQRS inbox query failed:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('returns zero when the PQRS badge count cannot be loaded', async () => {
    const prisma = {
      pqrsTicket: {
        count: jest.fn().mockRejectedValue(new Error('pqrs table unavailable')),
      },
    };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const service = new PqrsService(prisma as never);

    await expect(service.countByStatus('NUEVO')).resolves.toEqual({
      count: 0,
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'PQRS count failed:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
