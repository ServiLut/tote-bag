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
import { getOperatorRoleForEmail } from '../../common/utils/protected-admin.util';

@Injectable()
export class AuthService {
  private readonly supabase: { auth: SupabaseClient['auth'] } | null;

  constructor(private prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SERVICE_ROLE;

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

  async register(registerDto: RegisterDto, ip?: string) {
    const { email, password, acceptTerms, acceptDataPolicy } = registerDto;
    const supabaseAuth = this.getSupabaseAuth();

    const { data, error } = await supabaseAuth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Supabase Auth Error:', error);
      const msg = error.message.toLowerCase();

      if (msg.includes('already registered') || error.status === 422) {
        throw new ConflictException('Correo ya registrado');
      }

      if (msg.includes('password') || msg.includes('weak')) {
        throw new BadRequestException('Contrasena demasiado debil');
      }

      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new InternalServerErrorException(
        'No se pudo obtener el usuario de Supabase',
      );
    }

    const user = data.user;

    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (existingUser) {
      throw new ConflictException('Usuario ya registrado en el sistema local');
    }

    try {
      const initialRole = getOperatorRoleForEmail(email) ?? Role.CUSTOMER;

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
      console.error('Error creating user/profile:', error);
      throw new InternalServerErrorException(
        'Error al crear el perfil de usuario',
      );
    }

    const requiresEmailVerification = !data.session;

    return {
      message: requiresEmailVerification
        ? 'Registro iniciado. Por favor verifica tu correo electronico.'
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
      throw new BadRequestException('Credenciales invalidas');
    }

    const user = data.user;
    const requiredRole = getOperatorRoleForEmail(user.email) ?? Role.CUSTOMER;

    let userInDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });

    if (!userInDb && user) {
      try {
        console.log(`Creating missing user/profile for user ${user.email}`);
        userInDb = await this.prisma.user.create({
          data: {
            id: user.id,
            email: user.email!,
            role: requiredRole,
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

    const roleOverride = getOperatorRoleForEmail(user.email);
    if (userInDb && roleOverride && userInDb.role !== roleOverride) {
      try {
        userInDb = await this.prisma.user.update({
          where: { id: userInDb.id },
          data: { role: roleOverride },
          include: { profile: true },
        });
      } catch (err) {
        console.error('Failed to enforce protected/operator role on login', err);
      }
    }

    return {
      message: 'Inicio de sesion exitoso',
      user: data.user,
      session: data.session,
      role: roleOverride ?? userInDb?.role ?? Role.CUSTOMER,
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
      message: 'Correo de recuperacion enviado con exito',
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
