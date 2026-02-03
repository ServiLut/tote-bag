import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private supabase: { auth: SupabaseClient['auth'] };

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY ?? process.env.SERVICE_ROLE!,
    ) as unknown as { auth: SupabaseClient['auth'] };
  }

  async register(registerDto: RegisterDto, ip?: string) {
    const { email, password, acceptTerms } = registerDto;

    // 1. Intentar registro en Supabase
    const { data, error } = await this.supabase.auth.signUp({
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

    // 2. Guardar en PostgreSQL (Prisma)
    // Verificamos si ya existe el perfil para evitar error 500 feo (aunque el try/catch lo captura)
    const existingProfile = await this.prisma.profile.findUnique({
      where: { email },
    });

    if (existingProfile) {
      // Si existe en DB local pero Supabase dejó registrar (caso raro de desincronización),
      // o si Supabase retornó fake success.
      // Asumimos conflicto si ya tenemos el perfil.
      throw new ConflictException('Correo ya registrado en el sistema local');
    }

    try {
      await this.prisma.profile.create({
        data: {
          email: data.user.email!,
          userId: data.user.id,
          metadata: {
            termsAccepted: acceptTerms,
            termsAcceptedAt: new Date().toISOString(),
            registrationIp: ip,
          },
        },
      });
    } catch (error: unknown) {
      // Rollback idealmente, pero sin service_role no podemos borrar el user de supabase fácilmente.
      // Logueamos el error.
      console.error('Error creating profile:', error);
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
        id: data.user.id,
        email: data.user.email,
      },
      requiresEmailVerification,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException('Credenciales inválidas');
    }

    let profile = await this.prisma.profile.findUnique({
      where: { userId: data.user.id },
    });

    // Auto-healing: If user exists in Auth but not in Profile, create it.
    if (!profile && data.user) {
      try {
        console.log(`Creating missing profile for user ${data.user.email}`);
        profile = await this.prisma.profile.create({
          data: {
            email: data.user.email!,
            userId: data.user.id,
            role: 'CUSTOMER', // Default role
          },
        });
      } catch (err) {
        console.error('Failed to auto-create profile on login', err);
        // We continue, but role will fall back to default in response
      }
    }

    return {
      message: 'Inicio de sesión exitoso',
      user: data.user,
      session: data.session,
      role: profile?.role || 'CUSTOMER',
    };
  }
}
