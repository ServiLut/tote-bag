import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
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
import { PqrsModule } from './modules/pqrs/pqrs.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { ManagerApprovalsModule } from './modules/manager-approvals/manager-approvals.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesModule } from './modules/roles/roles.module';
import { StorageModule } from './common/storage/storage.module';
import { DebugRoleContextModule } from './common/context/debug-role-context.module';
import envValidationSchema from './config/env.validation';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import paymentConfig from './config/payment.config';
import cacheConfig from './config/cache.config';

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
          return { store: store as unknown as never };
        } catch (error) {
          console.error('[Redis] Failed to connect:', error);
          // Fallback to in-memory store
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
    PqrsModule,
    PayrollModule,
    PurchasesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
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
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
