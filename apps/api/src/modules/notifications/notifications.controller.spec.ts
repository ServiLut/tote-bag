import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShippingNotificationDto } from './dto/shipping-notification.dto';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const notificationsService = {
    handleShipmentDispatched: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  let controller: NotificationsController;

  const payload: ShippingNotificationDto = {
    event: 'shipment.dispatched',
    occurredAt: '2026-05-07T12:30:00.000Z',
    order: {
      id: 'order-1',
      orderNumber: 1234,
      trackingNumber: 'TRK-001',
    },
    customer: {
      email: 'cliente@correo.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationsController(
      notificationsService as never,
      configService,
    );
  });

  it('rejects requests with invalid bearer token', async () => {
    (configService.get as jest.Mock).mockReturnValue('token-seguro');

    await expect(
      controller.handleShippingNotification(payload, 'Bearer token-invalido'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      notificationsService.handleShipmentDispatched,
    ).not.toHaveBeenCalled();
  });

  it('rejects requests when endpoint token is not configured', async () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    await expect(
      controller.handleShippingNotification(payload, 'Bearer token-seguro'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ignores unsupported events without calling the service', async () => {
    (configService.get as jest.Mock).mockReturnValue('token-seguro');

    await expect(
      controller.handleShippingNotification(
        {
          ...payload,
          event: 'shipment.updated',
        },
        'Bearer token-seguro',
      ),
    ).resolves.toEqual({
      accepted: true,
      ignored: true,
      reason: 'unsupported_event',
    });

    expect(
      notificationsService.handleShipmentDispatched,
    ).not.toHaveBeenCalled();
  });

  it('delegates shipment.dispatched payloads to the service', async () => {
    (configService.get as jest.Mock).mockReturnValue('token-seguro');
    notificationsService.handleShipmentDispatched.mockResolvedValue({
      accepted: true,
      processed: true,
      channel: 'email',
      provider: 'log',
    });

    await expect(
      controller.handleShippingNotification(payload, 'Bearer token-seguro'),
    ).resolves.toEqual({
      accepted: true,
      processed: true,
      channel: 'email',
      provider: 'log',
    });

    expect(notificationsService.handleShipmentDispatched).toHaveBeenCalledWith(
      payload,
    );
  });

  it('rejects incomplete payloads through validation', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          event: 'shipment.dispatched',
          occurredAt: '2026-05-07T12:30:00.000Z',
          customer: {
            email: 'cliente@correo.com',
          },
        },
        {
          type: 'body',
          metatype: ShippingNotificationDto,
          data: '',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
