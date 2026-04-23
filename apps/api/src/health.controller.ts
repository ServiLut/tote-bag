import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

type HealthDependencyStatus = 'up' | 'down';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  async getReady() {
    const checkedAt = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        checkedAt,
        dependencies: {
          database: 'up' as HealthDependencyStatus,
        },
      };
    } catch (error) {
      this.logger.error('Readiness check failed', error);

      throw new ServiceUnavailableException({
        status: 'not_ready',
        checkedAt,
        dependencies: {
          database: 'down' as HealthDependencyStatus,
        },
      });
    }
  }
}
