import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import { DebugRoleContextService } from '../../common/context/debug-role-context.service';
import { isProtectedAdminEmail } from '../../common/utils/protected-admin.util';
import { canUseDebugRole } from '../../common/utils/debug-role.util';
import { Role } from '../../generated/client/enums';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debugRoleContext: DebugRoleContextService,
    private readonly configService: ConfigService,
  ) {}

  private appendAuthFlags<T extends { email?: string | null }>(profile: T) {
    return {
      ...profile,
      debugRoleAllowed: canUseDebugRole(
        profile.email,
        this.configService.get<string>('NODE_ENV'),
      ),
    };
  }

  private applyProtectedAdminProfile<
    T extends { email?: string | null; user?: { role?: Role | null } | null },
  >(profile: T) {
    if (!profile.user || !isProtectedAdminEmail(profile.email)) {
      return this.appendAuthFlags(profile);
    }

    return this.appendAuthFlags({
      ...profile,
      user: {
        ...profile.user,
        role: Role.ADMIN,
      },
    });
  }

  private applyCurrentUserProfileRole<
    T extends { email?: string | null; user?: { role?: Role | null } | null },
  >(profile: T) {
    if (!profile.user) {
      return this.appendAuthFlags(profile);
    }

    if (isProtectedAdminEmail(profile.email)) {
      return this.appendAuthFlags({
        ...profile,
        user: {
          ...profile.user,
          role: Role.ADMIN,
        },
      });
    }

    const debugRole = this.debugRoleContext.getDebugRole();
    if (!debugRole) {
      return this.appendAuthFlags(profile);
    }

    return this.appendAuthFlags({
      ...profile,
      user: {
        ...profile.user,
        role: debugRole,
      },
    });
  }

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
      const profiles = await this.prisma.profile.findMany(queryOptions);
      return profiles.map((profile) =>
        this.applyProtectedAdminProfile(profile),
      );
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
      items: items.map((profile) => this.applyProtectedAdminProfile(profile)),
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

    if (profile) {
      return this.applyCurrentUserProfileRole(profile);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return null;
    }

    const createdProfile = await this.prisma.profile.create({
      data: {
        email: user.email,
        userId: user.id,
      },
      include: { user: true },
    });

    return this.applyCurrentUserProfileRole(createdProfile);
  }

  async update(userId: string, data: Prisma.ProfileUpdateInput) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }
}
