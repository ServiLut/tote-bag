import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(profileId: string, createAddressDto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (createAddressDto.isDefault) {
        await tx.address.updateMany({
          where: { profileId },
          data: { isDefault: false },
        });
      }

      // Check if it's the first address, make it default if not specified
      const addressCount = await tx.address.count({ where: { profileId } });
      const isDefault =
        addressCount === 0 ? true : !!createAddressDto.isDefault;

      return tx.address.create({
        data: {
          ...createAddressDto,
          profileId,
          isDefault,
        },
        include: {
          department: true,
          municipality: true,
        },
      });
    });
  }

  async findAll(profileId: string) {
    return this.prisma.address.findMany({
      where: { profileId },
      include: {
        department: true,
        municipality: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, profileId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id },
      include: {
        department: true,
        municipality: true,
      },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    if (address.profileId !== profileId) {
      throw new ForbiddenException(
        'You do not have permission to access this address',
      );
    }

    return address;
  }

  async update(
    id: string,
    profileId: string,
    updateAddressDto: UpdateAddressDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findUnique({ where: { id } });
      if (!address) {
        throw new NotFoundException(`Address with ID ${id} not found`);
      }

      if (address.profileId !== profileId) {
        throw new ForbiddenException(
          'You do not have permission to update this address',
        );
      }

      if (updateAddressDto.isDefault && !address.isDefault) {
        await tx.address.updateMany({
          where: { profileId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: updateAddressDto,
        include: {
          department: true,
          municipality: true,
        },
      });
    });
  }

  async remove(id: string, profileId: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    if (address.profileId !== profileId) {
      throw new ForbiddenException(
        'You do not have permission to delete this address',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });

      // If we deleted the default address, make the most recent one default
      if (address.isDefault) {
        const lastAddress = await tx.address.findFirst({
          where: { profileId },
          orderBy: { createdAt: 'desc' },
        });

        if (lastAddress) {
          await tx.address.update({
            where: { id: lastAddress.id },
            data: { isDefault: true },
          });
        }
      }

      return { success: true };
    });
  }
}
