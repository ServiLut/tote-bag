import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import { DebugRoleContextService } from '../../common/context/debug-role-context.service';
import { isProtectedAdminEmail } from '../../common/utils/protected-admin.util';
import { canUseDebugRole } from '../../common/utils/debug-role.util';
import { Role } from '../../generated/client/enums';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

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

  private hasOwnProfileField<T extends object>(
    value: T,
    key: keyof T,
  ): boolean {
    return Boolean(Object.prototype.hasOwnProperty.call(value, key));
  }

  private async resolveProfileLocation(
    departmentId?: string | null,
    municipalityId?: string | null,
  ) {
    const [department, municipality] = await Promise.all([
      departmentId
        ? this.prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      municipalityId
        ? this.prisma.municipality.findUnique({
            where: { id: municipalityId },
            select: {
              id: true,
              name: true,
              departmentId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (departmentId && !department) {
      throw new BadRequestException('El departamento seleccionado no existe.');
    }

    if (municipalityId && !municipality) {
      throw new BadRequestException('El municipio seleccionado no existe.');
    }

    if (
      department &&
      municipality &&
      municipality.departmentId !== department.id
    ) {
      throw new BadRequestException(
        'El municipio no corresponde al departamento seleccionado.',
      );
    }

    return {
      department,
      municipality,
      resolvedDepartment: department ?? municipality?.department ?? null,
    };
  }

  private async buildSafeProfileUpdateData(data: UpdateMyProfileDto) {
    const updateData: Prisma.ProfileUncheckedUpdateInput = {};
    const assignableTextFields = [
      'firstName',
      'lastName',
      'phone',
      'neighborhood',
      'address',
    ] as const;

    assignableTextFields.forEach((field) => {
      if (this.hasOwnProfileField(data, field)) {
        updateData[field] = data[field] ?? null;
      }
    });

    const hasDepartmentName = this.hasOwnProfileField(data, 'department');
    const hasMunicipalityName = this.hasOwnProfileField(data, 'municipality');
    const hasDepartmentId = this.hasOwnProfileField(data, 'departmentId');
    const hasMunicipalityId = this.hasOwnProfileField(data, 'municipalityId');
    const touchedLocation =
      hasDepartmentName ||
      hasMunicipalityName ||
      hasDepartmentId ||
      hasMunicipalityId;

    if (!touchedLocation) {
      return updateData;
    }

    if (
      !hasDepartmentId &&
      !hasMunicipalityId &&
      ((data.department ?? null) !== null ||
        (data.municipality ?? null) !== null)
    ) {
      throw new BadRequestException(
        'La ubicacion debe enviarse usando IDs validos de departamento y municipio.',
      );
    }

    if (hasDepartmentId && data.departmentId === null) {
      updateData.departmentId = null;
      updateData.department = null;
      updateData.municipalityId = null;
      updateData.municipality = null;
      return updateData;
    }

    const { municipality, resolvedDepartment } =
      await this.resolveProfileLocation(
        hasDepartmentId ? (data.departmentId ?? null) : undefined,
        hasMunicipalityId ? (data.municipalityId ?? null) : undefined,
      );

    updateData.departmentId = resolvedDepartment?.id ?? null;
    updateData.department = resolvedDepartment?.name ?? null;
    updateData.municipalityId = municipality?.id ?? null;
    updateData.municipality = municipality?.name ?? null;

    return updateData;
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
          select: {
            orders: {
              where: { deletedAt: null },
            },
          },
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
          where: { deletedAt: null },
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

  async update(userId: string, data: UpdateMyProfileDto) {
    const updateData = await this.buildSafeProfileUpdateData(data);

    return this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });
  }
}
