import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { ShippingNotificationDto } from './dto/shipping-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('internal/shipping-notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(202)
  async handleShippingNotification(
    @Body() payload: ShippingNotificationDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    this.assertAuthorized(authorizationHeader);

    if (payload.event !== 'shipment.dispatched') {
      this.logger.warn(
        `[INTERNAL_SHIPPING_NOTIFICATION_IGNORED] event=${payload.event} orderId=${payload.order.id} reason=unsupported_event`,
      );

      return {
        accepted: true,
        ignored: true,
        reason: 'unsupported_event' as const,
      };
    }

    this.logger.log(
      `[INTERNAL_SHIPPING_NOTIFICATION_RECEIVED] event=${payload.event} orderId=${payload.order.id} orderNumber=${payload.order.orderNumber}`,
    );

    return this.notificationsService.handleShipmentDispatched(payload);
  }

  private assertAuthorized(authorizationHeader?: string) {
    const expectedToken = this.configService
      .get<string>('SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN')
      ?.trim();

    if (!expectedToken) {
      this.logger.error(
        '[INTERNAL_SHIPPING_NOTIFICATION_REJECTED] reason=missing_server_token_config',
      );
      throw new ServiceUnavailableException(
        'Shipping notifications endpoint is not configured.',
      );
    }

    const receivedToken = this.extractBearerToken(authorizationHeader);

    if (!receivedToken || !this.tokensMatch(expectedToken, receivedToken)) {
      this.logger.warn(
        '[INTERNAL_SHIPPING_NOTIFICATION_REJECTED] reason=invalid_bearer_token',
      );
      throw new UnauthorizedException(
        'Invalid shipping notifications authorization token.',
      );
    }
  }

  private extractBearerToken(authorizationHeader?: string) {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
      return null;
    }

    return token.trim();
  }

  private tokensMatch(expectedToken: string, receivedToken: string) {
    const expectedBuffer = Buffer.from(expectedToken);
    const receivedBuffer = Buffer.from(receivedToken);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
