import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentsMaintenanceService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    const intervalMinutes = Math.max(
      1,
      this.configService.get<number>('WEBHOOK_RETRY_INTERVAL_MINUTES') ?? 15,
    );

    this.intervalRef = setInterval(() => {
      void this.retryFailedWebhooks().catch((error) => {
        this.logger.error('Webhook retry cycle failed', error);
      });
    }, intervalMinutes * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async retryFailedWebhooks() {
    const result = await this.paymentsService.retryFailedWebhookEvents();

    if (result.retriedCount > 0) {
      this.logger.log(
        `Retried ${result.retriedCount} failed webhook(s); recovered ${result.recoveredCount}`,
      );
    }

    return result;
  }
}
