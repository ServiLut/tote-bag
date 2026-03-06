import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly superAdminEmails = new Set([
    'deybisasprilla@gmail.com',
    'admin@tote-bag.com',
  ]);
  private readonly managerEmails = new Set(['totebagbolsadetela@gmail.com']);

  private getWhitelistedRoleByEmail(
    email?: string | null,
  ): 'ADMIN' | 'MANAGER' | null {
    const normalizedEmail = email?.toLowerCase();
    if (!normalizedEmail) return null;
    if (this.superAdminEmails.has(normalizedEmail)) return 'ADMIN';
    if (this.managerEmails.has(normalizedEmail)) return 'MANAGER';
    return null;
  }

  async findAll(
    filters: {
      role?: 'ADMIN' | 'CUSTOMER';
      department?: string;
      municipality?: string;
    } = {},
  ) {
    const { role, department, municipality } = filters;

    const where: Prisma.ProfileWhereInput = {};
    if (role) {
      where.user = { role };
    }
    if (department) where.department = department;
    if (municipality) where.municipality = municipality;

    return this.prisma.profile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { role: true, isActive: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });
  }

  // Removiendo findAllByRole ya que findAll ahora maneja los filtros

  async findOne(id: string) {
    return this.prisma.profile.findUnique({
      where: { id },
      include: {
        user: true,
        orders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) return profile;

    const whitelistedRole = this.getWhitelistedRoleByEmail(profile.user?.email);
    if (whitelistedRole && profile.user?.role !== whitelistedRole) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: whitelistedRole },
      });

      return this.prisma.profile.findUnique({
        where: { userId },
        include: { user: true },
      });
    }

    return profile;
  }

  async update(userId: string, data: Prisma.ProfileUpdateInput) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }
}
