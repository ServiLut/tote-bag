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

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedFirstName = data.firstName.trim();
    const normalizedLastName = data.lastName.trim();
    const normalizedPhone = data.phone?.trim() || null;
    const normalizedNeighborhood = data.neighborhood?.trim() || null;
    const normalizedAddress = data.address?.trim() || null;

    const [existingLocalUser, department, municipality] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      }),
      data.departmentId
        ? this.prisma.department.findUnique({
            where: { id: data.departmentId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      data.municipalityId
        ? this.prisma.municipality.findUnique({
            where: { id: data.municipalityId },
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

    if (existingLocalUser) {
      throw new ConflictException('Correo ya registrado');
    }

    if (data.departmentId && !department) {
      throw new BadRequestException('El departamento seleccionado no existe.');
    }

    if (data.municipalityId && !municipality) {
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

    const resolvedDepartment = department ?? municipality?.department ?? null;
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
