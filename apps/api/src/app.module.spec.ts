jest.mock('@nestjs/common', () => ({
  Module: () => (target: unknown) => target,
  Catch: () => () => undefined,
  Logger: class {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigModule: {
    forRoot: jest.fn(() => ({})),
  },
  ConfigService: class {},
}));

jest.mock('@nestjs/cache-manager', () => ({
  CacheModule: {
    registerAsync: jest.fn(() => ({})),
  },
}));

jest.mock('cache-manager-redis-yet', () => ({
  redisStore: jest.fn(),
}));

jest.mock('@nestjs/core', () => ({
  APP_FILTER: Symbol('APP_FILTER'),
  APP_GUARD: Symbol('APP_GUARD'),
  APP_INTERCEPTOR: Symbol('APP_INTERCEPTOR'),
  BaseExceptionFilter: class {},
}));

jest.mock('@nestjs/throttler', () => ({
  ThrottlerModule: {
    forRoot: jest.fn(() => ({})),
  },
}));

jest.mock('@willsoto/nestjs-prometheus', () => ({
  PrometheusModule: {
    register: jest.fn(() => ({})),
  },
}));

jest.mock('@sentry/nestjs/setup', () => ({
  SentryModule: {
    forRoot: jest.fn(() => ({})),
  },
  SentryGlobalFilter: class {},
}));

jest.mock('./app.controller', () => ({
  AppController: class {},
}));

jest.mock('./app.service', () => ({
  AppService: class {},
}));

jest.mock('./modules/b2b/b2b.module', () => ({
  B2BModule: class {},
}));

jest.mock('./modules/auth/auth.module', () => ({
  AuthModule: class {},
}));

jest.mock('./modules/orders/orders.module', () => ({
  OrdersModule: class {},
}));

jest.mock('./modules/profiles/profiles.module', () => ({
  ProfilesModule: class {},
}));

jest.mock('./modules/payments/payments.module', () => ({
  PaymentsModule: class {},
}));

jest.mock('./modules/locations/locations.module', () => ({
  LocationsModule: class {},
}));

jest.mock('./modules/addresses/addresses.module', () => ({
  AddressesModule: class {},
}));

jest.mock('./prisma/prisma.module', () => ({
  PrismaModule: class {},
}));

jest.mock('./modules/configuration/configuration.module', () => ({
  ConfigurationModule: class {},
}));

jest.mock('./modules/pricing/pricing.module', () => ({
  PricingModule: class {},
}));

jest.mock('./modules/catalog/catalog.module', () => ({
  CatalogModule: class {},
}));

jest.mock('./modules/cart/cart.module', () => ({
  CartModule: class {},
}));

jest.mock('./modules/admin/admin.module', () => ({
  AdminModule: class {},
}));

jest.mock('./modules/personalizations/personalizations.module', () => ({
  PersonalizationsModule: class {},
}));

jest.mock('./modules/collections/collections.module', () => ({
  CollectionsModule: class {},
}));

jest.mock('./modules/wizard/wizard.module', () => ({
  WizardModule: class {},
}));

jest.mock('./modules/inventory/inventory.module', () => ({
  InventoryModule: class {},
}));

jest.mock('./modules/dashboard/dashboard.module', () => ({
  DashboardModule: class {},
}));

jest.mock('./modules/users/users.module', () => ({
  UsersModule: class {},
}));

jest.mock('./modules/shipping/shipping.module', () => ({
  ShippingModule: class {},
}));

jest.mock('./modules/pqrs/pqrs.module', () => ({
  PqrsModule: class {},
}));

jest.mock('./modules/payroll/payroll.module', () => ({
  PayrollModule: class {},
}));

jest.mock('./modules/purchases/purchases.module', () => ({
  PurchasesModule: class {},
}));

jest.mock('./modules/knowledge/knowledge.module', () => ({
  KnowledgeModule: class {},
}));

jest.mock('./modules/notifications/notifications.module', () => ({
  NotificationsModule: class {},
}));

jest.mock('./common/interceptors/audit.interceptor', () => ({
  AuditInterceptor: class {},
}));

jest.mock('./modules/audit/audit.module', () => ({
  AuditModule: class {},
}));

jest.mock('./modules/manager-approvals/manager-approvals.module', () => ({
  ManagerApprovalsModule: class {},
}));

jest.mock('./common/middleware/auth.middleware', () => ({
  AuthMiddleware: class {},
}));

jest.mock('./common/guards/throttler.guard', () => ({
  ThrottlerBehindProxyGuard: class {},
}));

jest.mock('./common/guards/permissions.guard', () => ({
  PermissionsGuard: class {},
}));

jest.mock('./modules/roles/roles.module', () => ({
  RolesModule: class {},
}));

jest.mock('./common/storage/storage.module', () => ({
  StorageModule: class {},
}));

jest.mock('./common/filters/prisma-connection.filter', () => ({
  PrismaConnectionExceptionFilter: class {},
}));

jest.mock('./common/context/debug-role-context.module', () => ({
  DebugRoleContextModule: class {},
}));

jest.mock('./health.controller', () => ({
  HealthController: class {},
}));

jest.mock('./config/env.validation', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./config/app.config', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./config/auth.config', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./config/database.config', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./config/payment.config', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./config/cache.config', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import {
  createMetricsAccessMiddleware,
  isMetricsRequestAllowed,
  isPrivateOrLoopbackIp,
  resolveMetricsAccessPolicy,
} from './app.module';

describe('AppModule metrics access helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa una politica segura por defecto en produccion y conserva acceso publico fuera de produccion', () => {
    expect(resolveMetricsAccessPolicy({ NODE_ENV: 'production' })).toBe(
      'private',
    );
    expect(resolveMetricsAccessPolicy({ NODE_ENV: 'development' })).toBe(
      'public',
    );
  });

  it('reconoce IPs privadas y loopback incluyendo IPv4 mapeada en IPv6', () => {
    expect(isPrivateOrLoopbackIp('::ffff:10.0.0.5')).toBe(true);
    expect(isPrivateOrLoopbackIp('192.168.1.20')).toBe(true);
    expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
  });

  it('permite proteger /metrics con token explicito', () => {
    const request = {
      headers: {
        authorization: 'Bearer metrics-secret',
      },
      originalUrl: '/metrics',
      socket: {},
    };

    expect(
      isMetricsRequestAllowed(request as never, {
        NODE_ENV: 'production',
        METRICS_ACCESS_POLICY: 'token',
        METRICS_BEARER_TOKEN: 'metrics-secret',
      }),
    ).toBe(true);

    expect(
      isMetricsRequestAllowed(request as never, {
        NODE_ENV: 'production',
        METRICS_ACCESS_POLICY: 'token',
        METRICS_BEARER_TOKEN: 'another-secret',
      }),
    ).toBe(false);
  });

  it('bloquea /metrics desde IP publica con la politica privada por defecto', () => {
    const next = jest.fn();
    const status = jest.fn().mockReturnThis();
    const send = jest.fn();
    const middleware = createMetricsAccessMiddleware({
      NODE_ENV: 'production',
    });

    middleware(
      {
        headers: {},
        ip: '8.8.8.8',
        originalUrl: '/api/metrics?format=prometheus',
        socket: {},
      } as never,
      { status, send } as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith('Forbidden');
  });

  it('no interfiere con rutas que no sean /metrics', () => {
    const next = jest.fn();
    const status = jest.fn().mockReturnThis();
    const send = jest.fn();
    const middleware = createMetricsAccessMiddleware({
      NODE_ENV: 'production',
    });

    middleware(
      {
        headers: {},
        ip: '8.8.8.8',
        originalUrl: '/api/orders',
        socket: {},
      } as never,
      { status, send } as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
