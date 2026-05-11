import { ConfigService } from '@nestjs/config';
import { resolveNotificationEmailProvider } from './notifications.provider';

describe('resolveNotificationEmailProvider', () => {
  const buildConfigService = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  it('uses explicit log provider when configured', () => {
    const configService = buildConfigService({
      NOTIFICATIONS_EMAIL_PROVIDER: 'log',
      RESEND_API_KEY: 're_test_123',
      NOTIFICATIONS_FROM_EMAIL: 'notificaciones@example.com',
    });

    expect(resolveNotificationEmailProvider(configService)).toBe('log');
  });

  it('uses explicit resend provider when configured', () => {
    const configService = buildConfigService({
      NOTIFICATIONS_EMAIL_PROVIDER: 'resend',
    });

    expect(resolveNotificationEmailProvider(configService)).toBe('resend');
  });

  it('auto-selects resend when resend credentials are present', () => {
    const configService = buildConfigService({
      RESEND_API_KEY: 're_test_123',
      NOTIFICATIONS_FROM_EMAIL: 'notificaciones@example.com',
    });

    expect(resolveNotificationEmailProvider(configService)).toBe('resend');
  });

  it('falls back to log when no real provider is configured', () => {
    const configService = buildConfigService({});

    expect(resolveNotificationEmailProvider(configService)).toBe('log');
  });
});
