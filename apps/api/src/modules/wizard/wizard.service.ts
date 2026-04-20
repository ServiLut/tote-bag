import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWizardOptionDto } from './dto/create-wizard-option.dto';
import { UpdateWizardOptionDto } from './dto/update-wizard-option.dto';
import { Prisma } from '../../generated/client/client';

@Injectable()
export class WizardService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.wizardOption.findMany({
      where: { deletedAt: null },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllGrouped() {
    const options = await this.prisma.wizardOption.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return options.reduce(
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
    return option;
  }

  async create(data: CreateWizardOptionDto) {
    try {
      const code =
        data.code ||
        `${data.category}_${data.name
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w-]/g, '')}`;

      return await this.prisma.wizardOption.create({
        data: {
          ...data,
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
      return await this.prisma.wizardOption.update({
        where: { id },
        data,
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
