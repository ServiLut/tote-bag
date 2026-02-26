import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { Prisma } from '../../generated/client/client';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.collection.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(createCollectionDto: CreateCollectionDto) {
    try {
      return await this.prisma.collection.create({
        data: createCollectionDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A collection with this slug already exists');
      }
      throw error;
    }
  }
}
