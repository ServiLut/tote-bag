import { BadRequestException } from '@nestjs/common';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  const prisma = {
    collection: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: CollectionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CollectionsService(prisma as never);
  });

  it('lists only active collections', async () => {
    prisma.collection.findMany.mockResolvedValue([{ id: 'col-1' }]);

    await service.findAll();

    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('soft-deletes collections without linked products', async () => {
    prisma.collection.findUnique.mockResolvedValue({
      id: 'col-1',
      _count: {
        products: 0,
      },
    });
    prisma.collection.update.mockResolvedValue({
      id: 'col-1',
      isActive: false,
    });

    await service.remove('col-1');

    expect(prisma.collection.update).toHaveBeenCalledWith({
      where: { id: 'col-1' },
      data: { isActive: false },
    });
  });

  it('rejects deleting collections with linked products', async () => {
    prisma.collection.findUnique.mockResolvedValue({
      id: 'col-1',
      _count: {
        products: 2,
      },
    });

    await expect(service.remove('col-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.collection.update).not.toHaveBeenCalled();
  });
});
