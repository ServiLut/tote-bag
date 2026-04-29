import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { getCacheRuntimeStatus, type RuntimeDependencyStatus } from './runtime-dependency-state';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    const cache = getCacheRuntimeStatus();

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
    const cache = getCacheRuntimeStatus();

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
