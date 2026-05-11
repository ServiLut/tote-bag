import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { NextFunction, Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { B2BModule } from './modules/b2b/b2b.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LocationsModule } from './modules/locations/locations.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { AdminModule } from './modules/admin/admin.module';
import { PersonalizationsModule } from './modules/personalizations/personalizations.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { WizardModule } from './modules/wizard/wizard.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PqrsModule } from './modules/pqrs/pqrs.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { ManagerApprovalsModule } from './modules/manager-approvals/manager-approvals.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesModule } from './modules/roles/roles.module';
import { StorageModule } from './common/storage/storage.module';
import { DebugRoleContextModule } from './common/context/debug-role-context.module';
import { PrismaConnectionExceptionFilter } from './common/filters/prisma-connection.filter';
import { HealthController } from './health.controller';
import envValidationSchema from './config/env.validation';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import paymentConfig from './config/payment.config';
import cacheConfig from './config/cache.config';
import { setCacheRuntimeStatus } from './runtime-dependency-state';

type MetricsAccessPolicy = 'public' | 'private' | 'token' | 'disabled';

type MetricsRequest = Pick<
  Request,
  'headers' | 'ip' | 'originalUrl' | 'path' | 'socket' | 'url'
>;

const metricsPathPattern = /^\/(?:api\/)?metrics\/?$/i;

function normalizeRequestPath(path: string | undefined): string {
  if (!path) {
    return '';
  }

  const [pathname] = path.split('?');
  const normalizedPath = pathname.replace(/\/+$/, '');

  return normalizedPath || '/';
}

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getRequestPath(request: MetricsRequest): string {
  return normalizeRequestPath(
    request.path || request.originalUrl || request.url,
  );
}

function getClientIp(request: MetricsRequest): string | null {
  const forwardedFor = getHeaderValue(request.headers['x-forwarded-for']);
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  const rawIp = forwardedIp || request.ip || request.socket?.remoteAddress;

  if (!rawIp) {
    return null;
  }

  return rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
}

function getBearerToken(
  headerValue: string | string[] | undefined,
): string | null {
  const authorizationHeader = getHeaderValue(headerValue);

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export function resolveMetricsAccessPolicy(
  env: NodeJS.ProcessEnv = process.env,
): MetricsAccessPolicy {
  const configuredPolicy = env.METRICS_ACCESS_POLICY?.trim().toLowerCase();

  if (
    configuredPolicy === 'public' ||
    configuredPolicy === 'private' ||
    configuredPolicy === 'token' ||
    configuredPolicy === 'disabled'
  ) {
    return configuredPolicy;
  }

  return env.NODE_ENV === 'production' ? 'private' : 'public';
}

export function isPrivateOrLoopbackIp(
  ipAddress: string | null | undefined,
): boolean {
  if (!ipAddress) {
    return false;
  }

  const normalizedIp = ipAddress
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, '');

  if (!normalizedIp) {
    return false;
  }

  if (
    normalizedIp === '::1' ||
    normalizedIp === '0:0:0:0:0:0:0:1' ||
    normalizedIp.startsWith('fc') ||
    normalizedIp.startsWith('fd') ||
    normalizedIp.startsWith('fe80:')
  ) {
    return true;
  }

  const ipv4Match = normalizedIp.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );

  if (!ipv4Match) {
    return false;
  }

  const [firstOctet, secondOctet, thirdOctet, fourthOctet] = ipv4Match
    .slice(1)
    .map((segment) => Number(segment));

  if (
    [firstOctet, secondOctet, thirdOctet, fourthOctet].some(
      (segment) => segment < 0 || segment > 255,
    )
  ) {
    return false;
  }

  return (
    firstOctet === 10 ||
    firstOctet === 127 ||
    (firstOctet === 169 && secondOctet === 254) ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)
  );
}

export function isMetricsRequestAllowed(
  request: MetricsRequest,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const requestPath = getRequestPath(request);

  if (!metricsPathPattern.test(requestPath)) {
    return true;
  }

  switch (resolveMetricsAccessPolicy(env)) {
    case 'public':
      return true;
    case 'disabled':
      return false;
    case 'token': {
      const expectedToken = env.METRICS_BEARER_TOKEN?.trim();

      if (!expectedToken) {
        return false;
      }

      const providedToken =
        getHeaderValue(request.headers['x-metrics-token'])?.trim() ||
        getBearerToken(request.headers.authorization);

      return providedToken === expectedToken;
    }
    case 'private':
    default:
      return isPrivateOrLoopbackIp(getClientIp(request));
  }
}

export function createMetricsAccessMiddleware(
  env: NodeJS.ProcessEnv = process.env,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isMetricsRequestAllowed(req, env)) {
      next();
      return;
    }

    res.status(403).send('Forbidden');
  };
}

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, paymentConfig, cacheConfig],
      validate: envValidationSchema,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          setCacheRuntimeStatus({
            status: 'degraded',
            mode: 'memory',
            configured: false,
            reason: 'missing_url',
          });
          return { ttl: 600 * 1000 };
        }

        try {
          const store = await redisStore({
            url: redisUrl,
            ttl: 600 * 1000,
            socket: {
              keepAlive: 10000,
              connectTimeout: 10000,
            },
          });
          setCacheRuntimeStatus({
            status: 'up',
            mode: 'redis',
            configured: true,
          });
          return { store: store as unknown as never };
        } catch (error) {
          console.error('[Redis] Failed to connect:', error);
          setCacheRuntimeStatus({
            status: 'degraded',
            mode: 'memory',
            configured: true,
            reason: 'connection_failed',
          });
          return { ttl: 600 * 1000 };
        }
      },
      inject: [ConfigService],
    }),
    DebugRoleContextModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrometheusModule.register({
      path: '/metrics',
    }),
    StorageModule,
    PrismaModule,
    RolesModule,
    DashboardModule,
    B2BModule,
    AuthModule,
    OrdersModule,
    ProfilesModule,
    PaymentsModule,
    LocationsModule,
    AddressesModule,
    AuditModule,
    ManagerApprovalsModule,
    ConfigurationModule,
    PricingModule,
    CatalogModule,
    CartModule,
    AdminModule,
    PersonalizationsModule,
    CollectionsModule,
    WizardModule,
    InventoryModule,
    UsersModule,
    ShippingModule,
    NotificationsModule,
    PqrsModule,
    PayrollModule,
    PurchasesModule,
    KnowledgeModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaConnectionExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(createMetricsAccessMiddleware()).forRoutes('*');
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
