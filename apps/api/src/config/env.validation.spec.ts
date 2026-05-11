import 'reflect-metadata';
import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const baseConfig = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tote_bag',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SERVICE_ROLE: 'service-role',
    JWT_SECRET: 'jwt-secret',
  };

  it('requires FRONTEND_URL in production-like environments', () => {
    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'production',
      }),
    ).toThrow(
      'FRONTEND_URL is required when NODE_ENV is production or provision.',
    );

    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'provision',
      }),
    ).toThrow(
      'FRONTEND_URL is required when NODE_ENV is production or provision.',
    );
  });

  it('requires shipping notification webhook in production-like environments', () => {
    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://shop.example.com',
      }),
    ).toThrow(
      'SHIPPING_NOTIFICATIONS_WEBHOOK_URL is required when NODE_ENV is production or provision.',
    );

    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'provision',
        FRONTEND_URL: 'https://shop.example.com',
      }),
    ).toThrow(
      'SHIPPING_NOTIFICATIONS_WEBHOOK_URL is required when NODE_ENV is production or provision.',
    );
  });

  it('accepts FRONTEND_URL in production and allows it to be omitted in development', () => {
    expect(
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'development',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
    });

    expect(
      envValidationSchema({
        ...baseConfig,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://shop.example.com',
        SHIPPING_NOTIFICATIONS_WEBHOOK_URL:
          'https://hooks.example.com/shipping',
      }),
    ).toMatchObject({
      FRONTEND_URL: 'https://shop.example.com',
      SHIPPING_NOTIFICATIONS_WEBHOOK_URL: 'https://hooks.example.com/shipping',
      NODE_ENV: 'production',
    });
  });

  it('validates metrics access policy and token requirements', () => {
    expect(() =>
      envValidationSchema({
        ...baseConfig,
        METRICS_ACCESS_POLICY: 'invalid',
      }),
    ).toThrow(
      'METRICS_ACCESS_POLICY must be one of public, private, token or disabled.',
    );

    expect(() =>
      envValidationSchema({
        ...baseConfig,
        METRICS_ACCESS_POLICY: 'token',
      }),
    ).toThrow(
      'METRICS_BEARER_TOKEN is required when METRICS_ACCESS_POLICY=token.',
    );

    expect(
      envValidationSchema({
        ...baseConfig,
        METRICS_ACCESS_POLICY: 'token',
        METRICS_BEARER_TOKEN: 'metrics-secret',
      }),
    ).toMatchObject({
      METRICS_ACCESS_POLICY: 'token',
      METRICS_BEARER_TOKEN: 'metrics-secret',
    });
  });

  it('validates notifications email provider constraints', () => {
    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NOTIFICATIONS_EMAIL_PROVIDER: 'invalid',
      }),
    ).toThrow('NOTIFICATIONS_EMAIL_PROVIDER must be one of log or resend.');

    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NOTIFICATIONS_EMAIL_PROVIDER: 'resend',
      }),
    ).toThrow(
      'RESEND_API_KEY is required when NOTIFICATIONS_EMAIL_PROVIDER=resend.',
    );

    expect(() =>
      envValidationSchema({
        ...baseConfig,
        NOTIFICATIONS_EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_123',
      }),
    ).toThrow(
      'NOTIFICATIONS_FROM_EMAIL is required when NOTIFICATIONS_EMAIL_PROVIDER=resend.',
    );

    expect(
      envValidationSchema({
        ...baseConfig,
        NOTIFICATIONS_EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_123',
        NOTIFICATIONS_FROM_EMAIL: 'notificaciones@example.com',
        NOTIFICATIONS_FROM_NAME: 'Tote Bag',
        NOTIFICATIONS_REPLY_TO_EMAIL: 'soporte@example.com',
      }),
    ).toMatchObject({
      NOTIFICATIONS_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_123',
      NOTIFICATIONS_FROM_EMAIL: 'notificaciones@example.com',
      NOTIFICATIONS_FROM_NAME: 'Tote Bag',
      NOTIFICATIONS_REPLY_TO_EMAIL: 'soporte@example.com',
    });
  });
});
