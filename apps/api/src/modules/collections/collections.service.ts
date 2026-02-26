import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Prisma } from '../../generated/client/client';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.collection.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(createCollectionDto: CreateCollectionDto) {
    try {
      return await this.prisma.collection.create({
        data: createCollectionDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A collection with this slug already exists',
        );
      }
      throw error;
    }
  }

  async update(id: string, updateCollectionDto: UpdateCollectionDto) {
    try {
      return await this.prisma.collection.update({
        where: { id },
        data: updateCollectionDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'A collection with this slug already exists',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Collection with ID ${id} not found`);
        }
      }
      throw error;
    }
  }

  async remove(id: string) {
    // 1. Check if collection exists
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    // 2. Critical Safety Rule: Check linked products
    if (collection._count.products > 0) {
      throw new BadRequestException(
        'No puedes eliminar esta colección porque tiene productos asociados. Reasigna los productos primero',
      );
    }

    // 3. Delete if safe
    return this.prisma.collection.delete({
      where: { id },
    });
  }
}
