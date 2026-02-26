import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  async update(id: string, data: any) {
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
      if (error.code === 'P2025') {
        throw new NotFoundException(`Personalization option with ID ${id} not found`);
      }
      throw error;
    }
  }
}
