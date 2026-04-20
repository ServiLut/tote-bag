import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { B2bService } from './b2b.service';

@Injectable()
export class B2BQuoteMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(B2BQuoteMaintenanceService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly b2bService: B2bService,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    const configuredIntervalMinutes = Number(
      this.configService.get<number>(
        'B2B_QUOTE_EXPIRATION_CHECK_INTERVAL_MINUTES',
      ) ?? 30,
    );
    const intervalMinutes = Number.isFinite(configuredIntervalMinutes)
      ? Math.max(1, configuredIntervalMinutes)
      : 30;

    this.intervalRef = setInterval(
      () => {
        void this.expireReservations().catch((error) => {
          this.logger.error('B2B quote reservation expiration failed', error);
        });
      },
      intervalMinutes * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async expireReservations() {
    const result = await this.b2bService.expireActiveReservations();

    if (result.expiredCount > 0) {
      this.logger.log(
        `Expired ${result.expiredCount} B2B quote stock reservation(s)`,
      );
    }

    return result;
  }
}
