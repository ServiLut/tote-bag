import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { DebugRoleContextService } from '../context/debug-role-context.service';
import {
  canUseDebugRole,
  getDebugRoleFromHeader,
  type DebugRole,
} from '../utils/debug-role.util';

type ResolvedUserRole = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string | null;
    role?: DebugRole | null;
  };
};

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private supabase: SupabaseClient<any, any, any, any>;
  private readonly superAdminEmails = new Set([
    'deybisasprilla@gmail.com',
    'admin@tote-bag.com',
  ]);
  private readonly managerEmails = new Set(['totebagbolsadetela@gmail.com']);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly debugRoleContext: DebugRoleContextService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      this.configService.get<string>('SERVICE_ROLE');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('AuthMiddleware: Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');
  }

  private getWhitelistedRoleByEmail(
    email?: string | null,
  ): ResolvedUserRole | null {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    if (this.superAdminEmails.has(normalizedEmail)) {
      return 'ADMIN';
    }

    if (this.managerEmails.has(normalizedEmail)) {
      return 'MANAGER';
    }

    return null;
  }

  private async syncAuthenticatedUser(user: {
    id: string;
    email?: string | null;
  }) {
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const whitelistedRole = this.getWhitelistedRoleByEmail(normalizedEmail);
    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: normalizedEmail,
        role: whitelistedRole ?? existingUser?.role ?? 'CUSTOMER',
        isActive: true,
      },
      create: {
        id: user.id,
        email: normalizedEmail,
        role: whitelistedRole ?? 'CUSTOMER',
        isActive: true,
      },
    });
  }

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const requestedDebugRole = getDebugRoleFromHeader(
      req.headers['x-debug-role'],
    );
    let effectiveDebugRole: DebugRole | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (!error && data.user) {
            const canUseRequestedDebugRole = canUseDebugRole(
              data.user.email,
              this.configService.get<string>('NODE_ENV'),
            );

            effectiveDebugRole =
              canUseRequestedDebugRole && requestedDebugRole
                ? requestedDebugRole
                : null;

            try {
              await this.syncAuthenticatedUser({
                id: data.user.id,
                email: data.user.email,
              });
            } catch (syncError) {
              console.error('AuthMiddleware: User sync failed:', syncError);
            }

            req.user = {
              id: data.user.id,
              email: data.user.email,
              role: effectiveDebugRole,
            };
          }
        } catch {
          // Ignore error, request will proceed without user
        }
      }
    }

    this.debugRoleContext.run(effectiveDebugRole, () => {
      next();
    });
  }
}
