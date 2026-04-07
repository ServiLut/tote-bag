import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import { DebugRoleContextService } from '../../common/context/debug-role-context.service';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debugRoleContext: DebugRoleContextService,
  ) {}

  async findAll(
    filters: {
      role?: 'ADMIN' | 'CUSTOMER';
      department?: string;
      municipality?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { role, department, municipality, search, page, pageSize } = filters;

    const where: Prisma.ProfileWhereInput = {};
    if (role) {
      where.user = { role };
    }
    if (department) where.department = department;
    if (municipality) where.municipality = municipality;
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const shouldPaginate =
      typeof page === 'number' &&
      Number.isFinite(page) &&
      page > 0 &&
      typeof pageSize === 'number' &&
      Number.isFinite(pageSize) &&
      pageSize > 0;

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' as const },
      include: {
        user: {
          select: { role: true, isActive: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    };

    if (!shouldPaginate) {
      return this.prisma.profile.findMany(queryOptions);
    }

    const safePage = page;
    const safePageSize = Math.min(pageSize, 100);
    const skip = (safePage - 1) * safePageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.profile.findMany({
        ...queryOptions,
        skip,
        take: safePageSize,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
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

    const debugRole = this.debugRoleContext.getDebugRole();
    if (!profile || !profile.user || !debugRole) {
      return profile;
    }

    return {
      ...profile,
      user: {
        ...profile.user,
        role: debugRole,
      },
    };
  }

  async update(userId: string, data: Prisma.ProfileUpdateInput) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }
}
