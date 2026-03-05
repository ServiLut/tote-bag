import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4003', 10),
  isProduction: process.env.NODE_ENV === 'production',
}));
