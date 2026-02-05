import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private supabase: SupabaseClient<any, any, any, any>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY || process.env.SERVICE_ROLE;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('AuthMiddleware: Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (!error && data.user) {
            // Attach user to request so it can be used by interceptors/controllers
            (req as unknown as { user: unknown }).user = data.user;
          }
        } catch {
          // Ignore error, request will proceed without user
        }
      }
    }

    next();
  }
}
