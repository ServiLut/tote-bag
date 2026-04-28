import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../generated/client/enums';
import { DebugRoleContextService } from '../context/debug-role-context.service';
import {
  canUseDebugRole,
  DEBUG_ROLE_HEADER,
  getDebugRoleFromHeader,
} from '../utils/debug-role.util';
import { getOperatorRoleForEmail } from '../utils/protected-admin.util';

export type RequestUser = {
  id: string;
  email?: string | null;
  role?: Role | null;
};

export type RequestWithUser = Request & {
  user?: RequestUser;
};

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private supabase: SupabaseClient<any, any, any, any>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly debugRoleContext: DebugRoleContextService,
  ) {
    const stripQuotes = (str: string | undefined) =>
      str?.replace(/^["']|["']$/g, '') || '';

    const supabaseUrl = stripQuotes(
      this.configService.get<string>('auth.supabaseUrl') ||
        this.configService.get<string>('SUPABASE_URL') ||
        this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL'),
    );
    const supabaseKey = stripQuotes(
      this.configService.get<string>('auth.supabaseKey') ||
        this.configService.get<string>('SUPABASE_ANON_KEY') ||
        this.configService.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
        this.configService.get<string>('SERVICE_ROLE'),
    );

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        'AuthMiddleware: Missing Supabase configuration. Using fallbacks if available.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async syncAuthenticatedUser(user: {
    id: string;
    email?: string | null;
  }) {
    const normalizedEmail = user.email?.trim();

    if (!normalizedEmail) {
      return;
    }

    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { email: true, role: true, isActive: true },
      });

      const roleOverride = getOperatorRoleForEmail(normalizedEmail);
      const resolvedRole = roleOverride ?? existingUser?.role ?? Role.CUSTOMER;
      const resolvedIsActive = existingUser?.isActive ?? true;

      if (
        existingUser &&
        existingUser.email === normalizedEmail &&
        existingUser.role === resolvedRole
      ) {
        return {
          role: resolvedRole,
          isActive: resolvedIsActive,
        };
      }

      await tx.user.upsert({
        where: { id: user.id },
        update: {
          email: normalizedEmail,
          role: resolvedRole,
        },
        create: {
          id: user.id,
          email: normalizedEmail,
          role: resolvedRole,
          isActive: true,
        },
      });

      return {
        role: resolvedRole,
        isActive: resolvedIsActive,
      };
    });
  }

  async use(req: RequestWithUser, _res: Response, next: NextFunction) {
    const requestedDebugRole = getDebugRoleFromHeader(
      req.headers[DEBUG_ROLE_HEADER],
    );
    const authHeader = req.headers.authorization;
    let effectiveDebugRole: Role | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (error) {
            console.error(
              'AuthMiddleware: Supabase validation error:',
              error.message,
            );
          } else if (data.user) {
            const canUseRequestedDebugRole = canUseDebugRole(
              data.user.email,
              this.configService.get<string>('NODE_ENV'),
            );

            effectiveDebugRole =
              canUseRequestedDebugRole && requestedDebugRole
                ? requestedDebugRole
                : null;

            try {
              const syncedUser = await this.syncAuthenticatedUser({
                id: data.user.id,
                email: data.user.email,
              });

              if (syncedUser?.isActive !== false) {
                req.user = {
                  id: data.user.id,
                  email: data.user.email,
                  role: effectiveDebugRole ?? null,
                };
              }
            } catch (syncError) {
              console.error('AuthMiddleware: User sync failed:', syncError);
              req.user = {
                id: data.user.id,
                email: data.user.email,
                role: effectiveDebugRole ?? null,
              };
            }
          }
        } catch (error) {
          console.error('AuthMiddleware: Unexpected exception:', error);
        }
      }
    }

    this.debugRoleContext.run(effectiveDebugRole, () => {
      next();
    });
  }
}
