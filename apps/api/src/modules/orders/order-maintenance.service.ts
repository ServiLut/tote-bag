import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';

@Injectable()
export class OrderMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderMaintenanceService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    const intervalMinutes = Math.max(
      1,
      this.configService.get<number>(
        'ORDER_EXPIRATION_CHECK_INTERVAL_MINUTES',
      ) ?? 30,
    );

    this.intervalRef = setInterval(() => {
      void this.expirePendingOrders().catch((error) => {
        this.logger.error('Pending order expiration failed', error);
      });
    }, intervalMinutes * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async expirePendingOrders() {
    const expirationHours = Math.max(
      1,
      this.configService.get<number>('ORDER_PENDING_EXPIRATION_HOURS') ?? 24,
    );

    const result = await this.ordersService.expirePendingPaymentOrders(
      expirationHours,
    );

    if (result.expiredCount > 0) {
      this.logger.log(
        `Expired ${result.expiredCount} pending payment order(s) older than ${expirationHours}h`,
      );
    }

    return result;
  }
}
