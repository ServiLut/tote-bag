import { WizardCategory } from '../../generated/client/enums';
import { WizardService } from './wizard.service';

describe('WizardService', () => {
  const prisma = {
    wizardOption: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: WizardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WizardService(prisma as never);
  });

  it('normalizes technique compatibility values to stable material ids on create', async () => {
    prisma.wizardOption.findMany.mockResolvedValue([
      {
        id: 'material-1',
        name: 'Lona',
      },
      {
        id: 'material-2',
        name: 'Algodon',
      },
    ]);
    prisma.wizardOption.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'technique-1',
        ...data,
      }),
    );

    await service.create({
      category: WizardCategory.TECHNIQUE,
      name: 'Serigrafia',
      allowedMaterialValues: ['Lona', 'material-2'],
    });

    const [createArgs] = prisma.wizardOption.create.mock
      .calls[0] as unknown as [
      {
        data: {
          allowedMaterialValues: string[];
        };
      },
    ];

    expect(createArgs.data.allowedMaterialValues).toEqual([
      'material-1',
      'material-2',
    ]);
  });

  it('exposes readable material names and resolved ids for technique options', async () => {
    prisma.wizardOption.findMany
      .mockResolvedValueOnce([
        {
          id: 'technique-1',
          category: WizardCategory.TECHNIQUE,
          name: 'DTF',
          code: 'DTF',
          description: null,
          basePriceModifier: 0,
          isActive: true,
          sortOrder: 1,
          allowedMaterialValues: ['material-1', 'Algodon'],
          imageUrl: null,
          deletedAt: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        { id: 'material-1', name: 'Lona' },
        { id: 'material-2', name: 'Algodon' },
      ]);

    const result = (await service.findAll()) as Array<{
      allowedMaterialIds: string[];
      allowedMaterialValues: string[];
    }>;

    expect(result).toEqual([
      expect.objectContaining({
        allowedMaterialIds: ['material-1', 'material-2'],
        allowedMaterialValues: ['Lona', 'Algodon'],
      }),
    ]);
  });
});
