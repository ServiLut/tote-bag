import {
  Inject,
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from './prisma/prisma.service';
import {
  type CacheRuntimeStatus,
  getCacheRuntimeStatus,
  type RuntimeDependencyStatus,
} from './runtime-dependency-state';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async resolveCacheStatus(): Promise<CacheRuntimeStatus> {
    const cache = getCacheRuntimeStatus();

    if (cache.mode !== 'redis' || cache.status !== 'up') {
      return cache;
    }

    const probeKey = `health:cache-probe:${Date.now()}`;
    const probeValue = 'ok';

    try {
      await this.cacheManager.set(probeKey, probeValue, 5_000);
      const storedValue = await this.cacheManager.get<string>(probeKey);
      await this.cacheManager.del(probeKey);

      if (storedValue !== probeValue) {
        throw new Error('Cache probe returned an unexpected value');
      }

      return cache;
    } catch (error) {
      this.logger.warn(
        `Cache runtime probe failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );

      return {
        ...cache,
        status: 'down',
        reason: 'runtime_unavailable',
      };
    }
  }

  @Get('health')
  async getHealth() {
    const cache = await this.resolveCacheStatus();

    return {
      status: cache.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        cache,
      },
    };
  }

  @Get('ready')
  async getReady() {
    const checkedAt = new Date().toISOString();
    const cache = await this.resolveCacheStatus();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        checkedAt,
        dependencies: {
          database: 'up' as RuntimeDependencyStatus,
          cache,
        },
      };
    } catch (error) {
      this.logger.error('Readiness check failed', error);

      throw new ServiceUnavailableException({
        status: 'not_ready',
        checkedAt,
        dependencies: {
          database: 'down' as RuntimeDependencyStatus,
          cache,
        },
      });
    }
  }
}
