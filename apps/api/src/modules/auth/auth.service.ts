import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../../generated/client/enums';
import {
  canUseDebugRole,
  getAvailableDebugRoles,
} from '../../common/utils/debug-role.util';

@Injectable()
export class AuthService {
  private readonly supabase: { auth: SupabaseClient['auth'] } | null;
  private readonly superAdminEmails = new Set([
    'deybisasprilla@gmail.com',
    'admin@tote-bag.com',
  ]);
  private readonly managerEmails = new Set(['totebagbolsadetela@gmail.com']);

  constructor(private prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SERVICE_ROLE;

    this.supabase =
      supabaseUrl && supabaseKey
        ? (createClient(supabaseUrl, supabaseKey) as unknown as {
            auth: SupabaseClient['auth'];
          })
        : null;
  }

  private getSupabaseAuth() {
    if (!this.supabase) {
      throw new ServiceUnavailableException(
        'El servicio de autenticacion no esta configurado correctamente.',
      );
    }

    return this.supabase.auth;
  }

  private getWhitelistedRoleByEmail(
    email?: string | null,
  ): 'ADMIN' | 'MANAGER' | null {
    const normalizedEmail = email?.toLowerCase();
    if (!normalizedEmail) return null;
    if (this.superAdminEmails.has(normalizedEmail)) return 'ADMIN';
    if (this.managerEmails.has(normalizedEmail)) return 'MANAGER';
    return null;
  }

  async register(registerDto: RegisterDto, ip?: string) {
    const { email, password, acceptTerms, acceptDataPolicy } = registerDto;
    const supabaseAuth = this.getSupabaseAuth();

    // 1. Intentar registro en Supabase
    const { data, error } = await supabaseAuth.signUp({
      email,
      password,
    });

    if (error) {
      // Manejo de errores específicos
      console.error('Supabase Auth Error:', error); // Log para debugging
      const msg = error.message.toLowerCase();

      if (msg.includes('already registered') || error.status === 422) {
        throw new ConflictException('Correo ya registrado');
      }

      if (msg.includes('password') || msg.includes('weak')) {
        throw new BadRequestException('Contraseña demasiado débil');
      }

      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new InternalServerErrorException(
        'No se pudo obtener el usuario de Supabase',
      );
    }

    const user = data.user;

    // 2. Guardar en PostgreSQL (Prisma)
    // Verificamos si ya existe el usuario para evitar error 500 feo
    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (existingUser) {
      throw new ConflictException('Usuario ya registrado en el sistema local');
    }

    try {
      // Determinar el rol inicial basado en el correo
      const initialRole =
        this.getWhitelistedRoleByEmail(user.email) ?? 'CUSTOMER';

      // Usamos una transacción para asegurar que ambos se creen
      await this.prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: user.id,
            email: user.email!,
            role: initialRole,
          },
        });

        await tx.profile.create({
          data: {
            email: user.email!,
            userId: user.id,
            dataPolicyAccepted: acceptDataPolicy,
            dataPolicyAcceptedAt: new Date(),
            dataPolicyAcceptedIp: ip,
            metadata: {
              termsAccepted: acceptTerms,
              termsAcceptedAt: new Date().toISOString(),
              registrationIp: ip,
            },
          },
        });
      });
    } catch (error: unknown) {
      // Rollback idealmente, pero sin service_role no podemos borrar el user de supabase fácilmente.
      console.error('Error creating user/profile:', error);
      throw new InternalServerErrorException(
        'Error al crear el perfil de usuario',
      );
    }

    // 3. Respuesta estructurada
    // Si session es null, suele indicar que se requiere confirmación de correo
    const requiresEmailVerification = !data.session;

    return {
      message: requiresEmailVerification
        ? 'Registro iniciado. Por favor verifica tu correo electrónico.'
        : 'Registro exitoso.',
      user: {
        id: user.id,
        email: user.email,
      },
      requiresEmailVerification,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const supabaseAuth = this.getSupabaseAuth();

    const { data, error } = await supabaseAuth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new BadRequestException('Credenciales inválidas');
    }

    const user = data.user;

    let userInDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });

    // Auto-healing: If user exists in Auth but not in our DB, create it.
    if (!userInDb && user) {
      try {
        console.log(`Creating missing user/profile for user ${user.email}`);
        userInDb = await this.prisma.user.create({
          data: {
            id: user.id,
            email: user.email!,
            role: this.getWhitelistedRoleByEmail(user.email) ?? 'CUSTOMER',
            profile: {
              create: {
                email: user.email!,
              },
            },
          },
          include: { profile: true },
        });
      } catch (err) {
        console.error('Failed to auto-create user/profile on login', err);
      }
    } else if (userInDb && !userInDb.profile) {
      // User exists but profile doesn't (rare)
      try {
        await this.prisma.profile.create({
          data: {
            email: userInDb.email,
            userId: userInDb.id,
          },
        });
      } catch (err) {
        console.error(
          'Failed to auto-create profile for existing user on login',
          err,
        );
      }
    }

    // Guarantee whitelisted roles for privileged emails.
    const whitelistedRole = this.getWhitelistedRoleByEmail(userInDb?.email);
    if (userInDb && whitelistedRole && userInDb.role !== whitelistedRole) {
      userInDb = await this.prisma.user.update({
        where: { id: userInDb.id },
        data: { role: whitelistedRole },
        include: { profile: true },
      });
    }

    return {
      message: 'Inicio de sesión exitoso',
      user: data.user,
      session: data.session,
      role: userInDb?.role || 'CUSTOMER',
    };
  }

  async forgotPassword(email: string) {
    const supabaseAuth = this.getSupabaseAuth();

    const { error } = await supabaseAuth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Correo de recuperación enviado con éxito',
    };
  }
  changeDebugRole(newRole: Role, email?: string | null) {
    if (!canUseDebugRole(email, process.env.NODE_ENV)) {
      throw new NotFoundException();
    }

    return {
      message: 'Rol de QA actualizado para la sesion actual',
      role: newRole,
      availableRoles: getAvailableDebugRoles(),
    };
  }
}
