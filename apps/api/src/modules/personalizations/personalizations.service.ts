import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { Prisma } from '../../generated/client/client';

@Injectable()
export class PersonalizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const options = await this.prisma.personalizationOption.findMany({
        orderBy: { name: 'asc' },
      });
      return options;
    } catch (error) {
      console.error('[PersonalizationsService] Error in findAll:', error);
      throw error;
    }
  }

  async update(id: string, data: UpdatePersonalizationDto) {
    try {
      const option = await this.prisma.personalizationOption.update({
        where: { id },
        data: {
          basePrice: data.basePrice,
          allowedMaterialValues: data.allowedMaterialValues,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
      return option;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Personalization option with ID ${id} not found`,
        );
      }
      throw error;
    }
  }
}
