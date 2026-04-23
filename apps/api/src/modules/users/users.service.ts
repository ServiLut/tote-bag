import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import { Role } from '../../generated/client/enums';
import {
  applyProtectedAdminRole,
  isProtectedAdminEmail,
} from '../../common/utils/protected-admin.util';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type CreatedCustomerProfile = {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  department: string | null;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Prisma.JsonValue | null;
  dataPolicyAccepted: boolean;
  dataPolicyAcceptedAt: Date | null;
  dataPolicyAcceptedIp: string | null;
  departmentId: string | null;
  municipalityId: string | null;
  user: {
    role: Role;
    isActive: boolean;
  };
  _count: {
    orders: number;
  };
};

const CUSTOMER_BAN_DURATION = '876000h';

@Injectable()
export class UsersService {
  private readonly supabaseAdmin: SupabaseClient | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService = new ConfigService(),
  ) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRole = this.configService.get<string>('SERVICE_ROLE');

    this.supabaseAdmin =
      supabaseUrl && serviceRole
        ? createClient(supabaseUrl, serviceRole)
        : null;
  }

  private getSupabaseAdmin() {
    if (!this.supabaseAdmin) {
      throw new ServiceUnavailableException(
        'El servicio administrativo de autenticacion no esta configurado.',
      );
    }

    return this.supabaseAdmin;
  }

  private normalizeCustomerFields(
    data: Pick<
      CreateCustomerDto | UpdateCustomerDto,
      'email' | 'firstName' | 'lastName' | 'phone' | 'neighborhood' | 'address'
    >,
  ) {
    return {
      normalizedEmail: data.email.trim().toLowerCase(),
      normalizedFirstName: data.firstName.trim(),
      normalizedLastName: data.lastName.trim(),
      normalizedPhone: data.phone?.trim() || null,
      normalizedNeighborhood: data.neighborhood?.trim() || null,
      normalizedAddress: data.address?.trim() || null,
    };
  }

  private mergeCustomerMetadata(
    currentMetadata: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base: Prisma.JsonObject =
      currentMetadata &&
      typeof currentMetadata === 'object' &&
      !Array.isArray(currentMetadata)
        ? currentMetadata
        : {};

    return {
      ...base,
      ...patch,
    } as Prisma.InputJsonValue;
  }

  private async resolveCustomerLocation(
    departmentId?: string,
    municipalityId?: string,
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

  private async findCustomerProfileOrThrow(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, role: true, isActive: true },
        },
        _count: {
          select: {
            orders: true,
            personalizationRequests: true,
          },
        },
      },
    });

    if (!profile || profile.user.role !== Role.CUSTOMER) {
      throw new NotFoundException(
        `Cliente con ID de usuario ${userId} no encontrado`,
      );
    }

    return profile;
  }

  private async findCustomerListProfileOrThrow(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { role: true, isActive: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!profile || profile.user.role !== Role.CUSTOMER) {
      throw new NotFoundException(
        `Cliente con ID de usuario ${userId} no encontrado`,
      );
    }

    return profile as unknown as CreatedCustomerProfile;
  }

  private handleSupabaseUserMutationError(
    error: { message: string; status?: number } | null,
  ) {
    if (!error) {
      return;
    }

    const message = error.message.toLowerCase();

    if (
      message.includes('already registered') ||
      message.includes('already been registered') ||
      error.status === 422
    ) {
      throw new ConflictException('Correo ya registrado');
    }

    throw new BadRequestException(error.message);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => applyProtectedAdminRole(user));
  }

  async createCustomer(data: CreateCustomerDto, actorUserId?: string) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const {
      normalizedEmail,
      normalizedFirstName,
      normalizedLastName,
      normalizedPhone,
      normalizedNeighborhood,
      normalizedAddress,
    } = this.normalizeCustomerFields(data);

    const [existingLocalUser, location] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      }),
      this.resolveCustomerLocation(data.departmentId, data.municipalityId),
    ]);

    if (existingLocalUser) {
      throw new ConflictException('Correo ya registrado');
    }
    const { municipality, resolvedDepartment } = location;
    const supabaseAdmin = this.getSupabaseAdmin();

    const { data: authResponse, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          source: 'dashboard-manual-customer',
          createdByUserId: actorUserId,
        },
      });

    if (authError) {
      const message = authError.message.toLowerCase();

      if (
        message.includes('already registered') ||
        message.includes('already been registered') ||
        authError.status === 422
      ) {
        throw new ConflictException('Correo ya registrado');
      }

      if (message.includes('password') || message.includes('weak')) {
        throw new BadRequestException('Contrasena demasiado debil');
      }

      throw new BadRequestException(authError.message);
    }

    const authUser = authResponse.user;

    if (!authUser?.id || !authUser.email) {
      throw new ServiceUnavailableException(
        'No se pudo crear el usuario en autenticacion.',
      );
    }

    const email = authUser.email;
    const userId = authUser.id;

    try {
      const createdProfile = await this.prisma.$transaction(
        async (tx): Promise<CreatedCustomerProfile> => {
          await tx.user.create({
            data: {
              id: userId,
              email: email,
              role: Role.CUSTOMER,
            },
          });

          return tx.profile.create({
            data: {
              email: email,
              userId: userId,
              firstName: normalizedFirstName,
              lastName: normalizedLastName,
              phone: normalizedPhone,
              department: resolvedDepartment?.name ?? null,
              municipality: municipality?.name ?? null,
              neighborhood: normalizedNeighborhood,
              address: normalizedAddress,
              departmentId: resolvedDepartment?.id ?? null,
              municipalityId: municipality?.id ?? null,
              dataPolicyAccepted: false,
              dataPolicyAcceptedAt: null,
              dataPolicyAcceptedIp: null,
              metadata: {
                source: 'dashboard-manual-customer',
                createdByUserId: actorUserId,
                createdAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
            include: {
              user: {
                select: { role: true, isActive: true },
              },
              _count: {
                select: { orders: true },
              },
            },
          }) as unknown as CreatedCustomerProfile;
        },
      );

      return {
        message: 'Cliente creado exitosamente',
        profile: createdProfile,
      };
    } catch (error) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      } catch (rollbackError: unknown) {
        console.error(
          'Failed to rollback auth user after local error:',
          rollbackError,
        );
      }

      throw error;
    }
  }

  async updateCustomer(
    userId: string,
    data: UpdateCustomerDto,
    actorUserId?: string,
  ) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const currentProfile = await this.findCustomerProfileOrThrow(userId);
    const {
      normalizedEmail,
      normalizedFirstName,
      normalizedLastName,
      normalizedPhone,
      normalizedNeighborhood,
      normalizedAddress,
    } = this.normalizeCustomerFields(data);

    const [existingLocalUser, location] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          NOT: {
            id: userId,
          },
        },
        select: { id: true },
      }),
      this.resolveCustomerLocation(data.departmentId, data.municipalityId),
    ]);

    if (existingLocalUser) {
      throw new ConflictException('Correo ya registrado');
    }

    const { municipality, resolvedDepartment } = location;
    const currentEmail = currentProfile.email.trim().toLowerCase();
    const shouldUpdateAuthEmail = currentEmail !== normalizedEmail;

    if (shouldUpdateAuthEmail) {
      const supabaseAdmin = this.getSupabaseAdmin();
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          source: 'dashboard-customer-update',
          updatedByUserId: actorUserId,
        },
      });

      this.handleSupabaseUserMutationError(error);
    }

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: normalizedEmail,
        },
      });

      return tx.profile.update({
        where: { userId },
        data: {
          email: normalizedEmail,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: normalizedPhone,
          department: resolvedDepartment?.name ?? null,
          municipality: municipality?.name ?? null,
          neighborhood: normalizedNeighborhood,
          address: normalizedAddress,
          departmentId: resolvedDepartment?.id ?? null,
          municipalityId: municipality?.id ?? null,
          metadata: this.mergeCustomerMetadata(currentProfile.metadata, {
            source: 'dashboard-customer-update',
            updatedByUserId: actorUserId,
            updatedAt: new Date().toISOString(),
          }),
        },
        include: {
          user: {
            select: { role: true, isActive: true },
          },
          _count: {
            select: { orders: true },
          },
        },
      }) as unknown as CreatedCustomerProfile;
    });

    return {
      message: 'Cliente actualizado exitosamente',
      profile: updatedProfile,
    };
  }

  async updateCustomerStatus(
    userId: string,
    isActive: boolean,
    actorUserId?: string,
  ) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    await this.findCustomerProfileOrThrow(userId);

    const supabaseAdmin = this.getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: isActive ? 'none' : CUSTOMER_BAN_DURATION,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    return {
      message: isActive
        ? 'Cliente activado exitosamente'
        : 'Cliente desactivado exitosamente',
      profile: await this.findCustomerListProfileOrThrow(userId),
    };
  }

  async deleteCustomer(userId: string, actorUserId?: string) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const currentProfile = await this.findCustomerProfileOrThrow(userId);

    if (currentProfile._count.orders > 0) {
      throw new BadRequestException(
        'No se puede eliminar el cliente porque tiene pedidos asociados.',
      );
    }

    if (currentProfile._count.personalizationRequests > 0) {
      throw new BadRequestException(
        'No se puede eliminar el cliente porque tiene solicitudes de personalizacion asociadas.',
      );
    }

    const supabaseAdmin = this.getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      message: 'Cliente eliminado exitosamente',
    };
  }

  async updateUserRole(userId: string, newRole: Role, actorUserId?: string) {
    if (!actorUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    if (isProtectedAdminEmail(user.email) && newRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Esta cuenta siempre debe conservar el rol ADMIN',
      );
    }

    if (
      actorUserId === userId &&
      user.role === Role.ADMIN &&
      newRole !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No puedes quitarte a ti mismo el rol ADMIN',
      );
    }

    if (user.role === Role.ADMIN && newRole !== Role.ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new ForbiddenException(
          'No puedes cambiar el rol del ultimo ADMIN activo',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      return { message: 'Rol actualizado exitosamente', role: newRole };
    });
  }
}
