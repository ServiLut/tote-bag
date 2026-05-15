import { ConfigService } from '@nestjs/config';
import {
  NotificationEmailProvider,
  SUPPORTED_NOTIFICATION_EMAIL_PROVIDERS,
} from './notifications.constants';

export function isNotificationEmailProvider(
  value: string | undefined | null,
): value is NotificationEmailProvider {
  return SUPPORTED_NOTIFICATION_EMAIL_PROVIDERS.includes(
    value as NotificationEmailProvider,
  );
}

export function resolveNotificationEmailProvider(
  configService: Pick<ConfigService, 'get'>,
): NotificationEmailProvider {
  const configuredProvider = configService
    .get<string>('NOTIFICATIONS_EMAIL_PROVIDER')
    ?.trim()
    .toLowerCase();

  if (isNotificationEmailProvider(configuredProvider)) {
    return configuredProvider;
  }

  const resendApiKey = configService.get<string>('RESEND_API_KEY')?.trim();
  const fromEmail = configService
    .get<string>('NOTIFICATIONS_FROM_EMAIL')
    ?.trim();

  if (resendApiKey && fromEmail) {
    return 'resend';
  }

  return 'log';
}
