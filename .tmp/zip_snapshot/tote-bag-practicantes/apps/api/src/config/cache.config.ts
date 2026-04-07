import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  redisUrl: process.env.REDIS_URL,
  ttl: parseInt(process.env.CACHE_TTL || '600000', 10), // 10 minutes default
}));
