import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SERVICE_ROLE,
  jwtSecret: process.env.JWT_SECRET,
}));
