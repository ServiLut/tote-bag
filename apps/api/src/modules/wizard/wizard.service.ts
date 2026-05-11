import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWizardOptionDto } from './dto/create-wizard-option.dto';
import { UpdateWizardOptionDto } from './dto/update-wizard-option.dto';
import { Prisma } from '../../generated/client/client';
import { WizardCategory } from '../../generated/client/enums';

type MaterialReference = {
  id: string;
  name: string;
};

@Injectable()
export class WizardService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLabel(value?: string | null) {
    return (
      value
        ?.trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() ?? ''
    );
  }

  private async getActiveMaterials() {
    return this.prisma.wizardOption.findMany({
      where: {
        category: WizardCategory.MATERIAL,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private dedupeStrings(values: string[]) {
    return Array.from(new Set(values));
  }

  private resolveStoredAllowedMaterialValues(
    allowedMaterialValues: string[] | undefined,
    materials: MaterialReference[],
  ) {
    if (!allowedMaterialValues) {
      return allowedMaterialValues;
    }

    const materialsById = new Map(materials.map((material) => [material.id, material]));
    const materialsByName = new Map(
      materials.map((material) => [this.normalizeLabel(material.name), material]),
    );

    const resolvedValues = allowedMaterialValues
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        if (materialsById.has(value)) {
          return value;
        }

        return materialsByName.get(this.normalizeLabel(value))?.id ?? value;
      });

    return this.dedupeStrings(resolvedValues);
  }

  private resolveReadableAllowedMaterialValues(
    allowedMaterialValues: string[] | undefined,
    materials: MaterialReference[],
  ) {
    if (!allowedMaterialValues) {
      return [];
    }

    const materialsById = new Map(materials.map((material) => [material.id, material]));
    const materialsByName = new Map(
      materials.map((material) => [this.normalizeLabel(material.name), material]),
    );

    return this.dedupeStrings(
      allowedMaterialValues
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const materialById = materialsById.get(value);
          if (materialById) {
            return materialById.name;
          }

          const materialByName = materialsByName.get(this.normalizeLabel(value));
          return materialByName?.name ?? value;
        }),
    );
  }

  private resolveAllowedMaterialIds(
    allowedMaterialValues: string[] | undefined,
    materials: MaterialReference[],
  ) {
    if (!allowedMaterialValues) {
      return [];
    }

    const materialsById = new Map(materials.map((material) => [material.id, material]));
    const materialsByName = new Map(
      materials.map((material) => [this.normalizeLabel(material.name), material]),
    );

    return this.dedupeStrings(
      allowedMaterialValues
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          if (materialsById.has(value)) {
            return value;
          }

          return materialsByName.get(this.normalizeLabel(value))?.id ?? null;
        })
        .filter((value): value is string => Boolean(value)),
    );
  }

  private async normalizeTechniqueAllowedMaterialValues(
    category: WizardCategory | undefined,
    allowedMaterialValues: string[] | undefined,
  ) {
    if (category !== WizardCategory.TECHNIQUE || !allowedMaterialValues) {
      return allowedMaterialValues;
    }

    const materials = await this.getActiveMaterials();
    return this.resolveStoredAllowedMaterialValues(allowedMaterialValues, materials);
  }

  private async decorateOptionWithResolvedMaterials<
    T extends {
      category: WizardCategory;
      allowedMaterialValues?: string[];
    },
  >(option: T) {
    if (option.category !== WizardCategory.TECHNIQUE) {
      return {
        ...option,
        allowedMaterialIds: [],
      };
    }

    const materials = await this.getActiveMaterials();

    return {
      ...option,
      allowedMaterialIds: this.resolveAllowedMaterialIds(
        option.allowedMaterialValues,
        materials,
      ),
      allowedMaterialValues: this.resolveReadableAllowedMaterialValues(
        option.allowedMaterialValues,
        materials,
      ),
    };
  }

  private async decorateOptionsWithResolvedMaterials<
    T extends {
      category: WizardCategory;
      allowedMaterialValues?: string[];
    },
  >(options: T[]) {
    const materials = await this.getActiveMaterials();

    return options.map((option) => ({
      ...option,
      allowedMaterialIds:
        option.category === WizardCategory.TECHNIQUE
          ? this.resolveAllowedMaterialIds(option.allowedMaterialValues, materials)
          : [],
      allowedMaterialValues:
        option.category === WizardCategory.TECHNIQUE
          ? this.resolveReadableAllowedMaterialValues(
              option.allowedMaterialValues,
              materials,
            )
          : option.allowedMaterialValues ?? [],
    }));
  }

  async findAll() {
    const options = await this.prisma.wizardOption.findMany({
      where: { deletedAt: null },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return this.decorateOptionsWithResolvedMaterials(options);
  }

  async findAllGrouped() {
    const options = await this.prisma.wizardOption.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    const decoratedOptions = await this.decorateOptionsWithResolvedMaterials(options);

    return decoratedOptions.reduce(
      (acc, curr) => {
        if (!acc[curr.category]) {
          acc[curr.category] = [];
        }
        acc[curr.category].push(curr);
        return acc;
      },
      {} as Record<string, typeof options>,
    );
  }

  async findOne(id: string) {
    const option = await this.prisma.wizardOption.findUnique({
      where: { id },
    });
    if (!option)
      throw new NotFoundException(`Wizard option with ID ${id} not found`);

    return this.decorateOptionWithResolvedMaterials(option);
  }

  async create(data: CreateWizardOptionDto) {
    try {
      const allowedMaterialValues =
        await this.normalizeTechniqueAllowedMaterialValues(
          data.category,
          data.allowedMaterialValues,
        );
      const code =
        data.code ||
        `${data.category}_${data.name
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w-]/g, '')}`;

      return await this.prisma.wizardOption.create({
        data: {
          ...data,
          allowedMaterialValues,
          code,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A wizard option with this code already exists',
        );
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateWizardOptionDto) {
    try {
      const currentOption =
        data.allowedMaterialValues !== undefined || data.category !== undefined
          ? await this.prisma.wizardOption.findUnique({
              where: { id },
              select: { category: true },
            })
          : null;
      const effectiveCategory = data.category ?? currentOption?.category;
      const allowedMaterialValues =
        data.allowedMaterialValues === undefined
          ? undefined
          : await this.normalizeTechniqueAllowedMaterialValues(
              effectiveCategory,
              data.allowedMaterialValues,
            );

      return await this.prisma.wizardOption.update({
        where: { id },
        data: {
          ...data,
          ...(allowedMaterialValues !== undefined
            ? { allowedMaterialValues }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Code already exists');
        if (error.code === 'P2025')
          throw new NotFoundException(`Option with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.wizardOption.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Option with ID ${id} not found`);
      }
      throw error;
    }
  }
}
